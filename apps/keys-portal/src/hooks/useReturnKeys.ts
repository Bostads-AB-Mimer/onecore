import { useEffect, useState } from 'react'

import type {
  CardDetails,
  KeyDetails,
  KeyLoanWithDetails,
} from '@/services/types'
import { resolveActiveLoansForItems } from '@/services/loans/resolveActiveLoans'
import { useToast } from '@/hooks/use-toast'
import {
  partialReturnLoan,
  returnLoan,
  type ReturnOpts,
} from '@/services/loans/returnFlow'

export type KeyForReturn = KeyDetails & { isOrphan: boolean }
export type CardForReturn = CardDetails & { isOrphan: boolean }
export type ReturnLoanGroup = {
  loanId: string
  loanLabel: string
  keys: KeyForReturn[]
  cards: CardForReturn[]
}

type Args = {
  open: boolean
  keyIds: string[]
  cardIds?: string[]
  allKeys: KeyDetails[]
  allCards?: CardDetails[]
  onClose: () => void
  onSuccess: () => void
}

/**
 * The shared brain for both return dialogs: resolves the active loans behind the
 * selected items, owns the keep/return selection, detects partial mode, and runs the
 * full or partial return per affected loan (tenant or maintenance — the resolved loan's
 * `loanType` drives the receipt). Dialogs supply only their right-pane + `opts`.
 */
export function useReturnKeys({
  open,
  keyIds,
  cardIds = [],
  allKeys,
  allCards = [],
  onClose,
  onSuccess,
}: Args) {
  const { toast } = useToast()
  const [loans, setLoans] = useState<KeyLoanWithDetails[]>([])
  const [loanGroups, setLoanGroups] = useState<ReturnLoanGroup[]>([])
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set())
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Key the resolve on the dialog opening + the requested ids (serialized), NOT the
  // array refs. Callers pass inline `.map()` / default `[]` arrays that change identity
  // every render; depending on them would re-fire this effect (re-fetch + reset the
  // selection) on every render. allKeys/allCards are read from the closure — they don't
  // change while a dialog is open on the same items.
  const keyIdsKey = keyIds.join(',')
  const cardIdsKey = cardIds.join(',')

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const resolved = await resolveActiveLoansForItems(keyIds, cardIds)
        if (cancelled) return

        const knownKeys = new Map(allKeys.map((k) => [k.id, k]))
        const knownCards = new Map(allCards.map((c) => [c.cardId, c]))
        const groups: ReturnLoanGroup[] = resolved.map((loan, i) => ({
          loanId: loan.id,
          loanLabel: loan.contact
            ? `Lån ${i + 1} • ${loan.contact}`
            : `Lån ${i + 1}`,
          keys: (loan.keysArray ?? []).map((k) => {
            const known = knownKeys.get(k.id)
            return known
              ? { ...known, isOrphan: false }
              : { ...(k as KeyDetails), isOrphan: true }
          }),
          cards: (loan.keyCardsArray ?? []).map((c) => {
            const known = knownCards.get(c.cardId)
            return known
              ? { ...known, isOrphan: false }
              : { ...(c as CardDetails), isOrphan: true }
          }),
        }))

        // Pre-check the items the operator originally selected (+ any orphans),
        // skipping disposed keys (auto-included, never user-checkable).
        const initKeys = new Set<string>()
        const initCards = new Set<string>()
        groups.forEach((g) => {
          g.keys
            .filter((k) => !k.disposed)
            .forEach((k) => {
              if (keyIds.includes(k.id) || k.isOrphan) initKeys.add(k.id)
            })
          g.cards.forEach((c) => {
            if (cardIds.includes(c.cardId) || c.isOrphan)
              initCards.add(c.cardId)
          })
        })

        setLoans(resolved)
        setLoanGroups(groups)
        setSelectedKeyIds(initKeys)
        setSelectedCardIds(initCards)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyIdsKey, cardIdsKey])

  const toggle = (set: Set<string>, id: string, checked: boolean) => {
    const next = new Set(set)
    if (checked) next.add(id)
    else next.delete(id)
    return next
  }
  const toggleKey = (id: string, checked: boolean) =>
    setSelectedKeyIds((prev) => toggle(prev, id, checked))
  const toggleCard = (id: string, checked: boolean) =>
    setSelectedCardIds((prev) => toggle(prev, id, checked))

  // A loan is "partial" when some but not all of its selectable (non-disposed) items
  // are checked. The whole dialog is in partial mode if any loan is.
  const loanSelectableCount = (g: ReturnLoanGroup) => {
    const nonDisposed = g.keys.filter((k) => !k.disposed)
    const total = nonDisposed.length + g.cards.length
    const selected =
      nonDisposed.filter((k) => selectedKeyIds.has(k.id)).length +
      g.cards.filter((c) => selectedCardIds.has(c.cardId)).length
    return { total, selected }
  }
  const partialMode = loanGroups.some((g) => {
    const { total, selected } = loanSelectableCount(g)
    return selected > 0 && selected < total
  })

  // Loans whose (full) return would mark every selectable item missing — nothing checked
  // but there are items to lose. The dialog confirms these before a non-partial return.
  const loansClosingAllMissing = loanGroups.filter((g) => {
    const { total, selected } = loanSelectableCount(g)
    return total > 0 && selected === 0
  })

  const selectedCount = selectedKeyIds.size + selectedCardIds.size
  const totalCount = loanGroups.reduce(
    (sum, g) => sum + g.keys.length + g.cards.length,
    0
  )

  // One executor for both submit paths: run a per-loan action, aggregate
  // failures/warnings, then toast and close. `perLoan` returns null to skip/succeed.
  type LoanOutcome = { message?: string; warning?: boolean } | null
  const execute = async (
    perLoan: (
      loan: KeyLoanWithDetails,
      group: ReturnLoanGroup
    ) => Promise<LoanOutcome>,
    labels: { success: string; failure: string }
  ) => {
    setIsProcessing(true)
    try {
      const failures: string[] = []
      let warnings = 0
      for (const loan of loans) {
        const group = loanGroups.find((g) => g.loanId === loan.id)
        if (!group) continue
        const outcome = await perLoan(loan, group)
        if (outcome?.message) failures.push(outcome.message)
        else if (outcome?.warning) warnings++
      }

      if (failures.length > 0) {
        toast({
          title: labels.failure,
          description: failures.join('\n'),
          variant: 'destructive',
        })
        return
      }
      toast({
        title: labels.success,
        description:
          warnings > 0
            ? 'Det fanns ingen ursprunglig låneblankett att kombinera; den nya innehåller bara återlämningskvittensen.'
            : undefined,
      })
      onClose()
      onSuccess()
    } finally {
      setIsProcessing(false)
    }
  }

  // Full return of every affected loan; unchecked non-disposed items are missing/lost.
  // A loan with nothing selected closes entirely-missing — that's a legitimate "all keys
  // lost" return, but the dialog confirms it first (see `loansClosingAllMissing`) so it's
  // never silent.
  const accept = (opts: ReturnOpts) =>
    execute(
      async (loan) => {
        const r = await returnLoan(
          loan,
          { selectedKeyIds, selectedCardIds },
          opts
        )
        return r.success ? null : { message: r.message ?? 'Okänt fel' }
      },
      {
        success: 'Nycklar/droppar återlämnade',
        failure: 'Återlämning misslyckades för vissa lån',
      }
    )

  // Per loan: fully-selected returns whole, partly-selected splits onto a continuation
  // loan, untouched is skipped.
  const partialAccept = (opts: ReturnOpts) =>
    execute(
      async (loan, group) => {
        const selection = { selectedKeyIds, selectedCardIds }
        const { total, selected } = loanSelectableCount(group)
        if (selected === 0) return null
        if (selected === total) {
          const r = await returnLoan(loan, selection, opts)
          return r.success ? null : { message: r.message ?? 'Okänt fel' }
        }
        const r = await partialReturnLoan(loan, selection, opts)
        if (!r.success) return { message: r.message ?? 'Okänt fel' }
        return { warning: !!r.fellBackToReturnOnly }
      },
      {
        success: 'Partiell retur klar',
        failure: 'Partiell retur misslyckades för vissa lån',
      }
    )

  return {
    loading,
    isProcessing,
    loanGroups,
    selectedKeyIds,
    selectedCardIds,
    toggleKey,
    toggleCard,
    partialMode,
    loansClosingAllMissing,
    selectedCount,
    totalCount,
    accept,
    partialAccept,
  }
}
