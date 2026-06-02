import { useMemo, useState } from 'react'

import type { Lease, KeyDetails, CardDetails } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { createPendingLoan } from '@/services/loans/createLoan'
import { disposeKeys, undoDisposeKeys } from '@/services/disposeKeys'
import {
  findExistingActiveLoansForTransfer,
  type ExistingLoanInfo,
} from '@/services/loanTransferHelpers'

type SelectionApi = { deselectAll: () => void }

type Args = {
  lease: Lease
  keys: KeyDetails[]
  cards: CardDetails[]
  refreshStatuses: () => Promise<void>
  keySelection: SelectionApi
  cardSelection: SelectionApi
  onKeysLoaned?: () => void
  onKeysReturned?: () => void
}

/**
 * Loan/return/dispose actions for a lease's keys + the open-state of the three dialogs
 * they drive. Returns the handlers (for KeyActionButtons) plus a `dialogs` bag the
 * component spreads onto each dialog.
 */
export function useLeaseKeyActions({
  lease,
  keys,
  cards,
  refreshStatuses,
  keySelection,
  cardSelection,
  onKeysLoaned,
  onKeysReturned,
}: Args) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [receipt, setReceipt] = useState<{
    open: boolean
    receiptId: string | null
  }>({ open: false, receiptId: null })
  const [transfer, setTransfer] = useState<{
    open: boolean
    keyIds: string[]
    cardIds: string[]
    existingLoans: ExistingLoanInfo[]
  }>({ open: false, keyIds: [], cardIds: [], existingLoans: [] })
  const [ret, setRet] = useState<{
    open: boolean
    keyIds: string[]
    cardIds: string[]
  }>({ open: false, keyIds: [], cardIds: [] })

  const tenantContactCodes = useMemo(
    () => (lease.tenants ?? []).map((t) => t.contactCode).filter(Boolean),
    [lease]
  )

  const clearSelection = () => {
    keySelection.deselectAll()
    cardSelection.deselectAll()
  }

  const createLoanAndShowReceipt = async (
    keyIds: string[],
    cardIds: string[]
  ) => {
    const contact = tenantContactCodes[0]
    if (!contact) {
      toast({
        title: 'Fel',
        description: 'Hyresgästen saknar kontaktkod — kan inte skapa lån.',
        variant: 'destructive',
      })
      return
    }
    setIsProcessing(true)
    const result = await createPendingLoan({
      loanType: 'TENANT',
      keyIds,
      cardIds,
      contact,
      contact2: tenantContactCodes[1],
    })
    if (result.success) {
      await refreshStatuses()
      clearSelection()
      if (result.receiptId)
        setReceipt({ open: true, receiptId: result.receiptId })
      else onKeysLoaned?.()
    }
    toast({
      title: result.title,
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })
    setIsProcessing(false)
  }

  // Loan-out: offer the transfer flow if the tenant already has an active loan here,
  // otherwise create the pending loan and open its receipt to print.
  const onRent = async (keyIds: string[], cardIds: string[]) => {
    const existingLoans = await findExistingActiveLoansForTransfer(
      tenantContactCodes,
      lease.rentalPropertyId
    )
    if (existingLoans.length > 0) {
      setTransfer({ open: true, keyIds, cardIds, existingLoans })
      return
    }
    await createLoanAndShowReceipt(keyIds, cardIds)
  }

  const onReturn = (keyIds: string[], cardIds: string[]) =>
    setRet({ open: true, keyIds, cardIds })

  const onDispose = async (keyIds: string[]) => {
    setIsProcessing(true)
    const result = await disposeKeys(keyIds)
    if (result.success) {
      await refreshStatuses()
      keySelection.deselectAll()
      toast({
        title: result.title,
        description: result.message,
        duration: 10000,
        variant: 'destructive',
        className: '!w-full !p-4 !shadow-xl',
        action: (
          <ToastAction
            altText="Ångra kasseringen"
            className="!px-3 !text-sm !font-semibold !opacity-100"
            onClick={async () => {
              const undo = await undoDisposeKeys(keyIds)
              await refreshStatuses()
              const undoToast = toast({
                title: undo.title,
                description: undo.message,
              })
              setTimeout(() => undoToast.dismiss(), 3000)
            }}
          >
            Ångra
          </ToastAction>
        ),
      })
    } else {
      toast({
        title: result.title,
        description: result.message,
        variant: 'destructive',
      })
    }
    setIsProcessing(false)
  }

  return {
    isProcessing,
    onRent,
    onReturn,
    onDispose,
    dialogs: {
      receipt: {
        open: receipt.open,
        receiptId: receipt.receiptId,
        onClose: () => {
          setReceipt({ open: false, receiptId: null })
          onKeysLoaned?.()
        },
      },
      transfer: {
        open: transfer.open,
        newKeys: keys.filter((k) => transfer.keyIds.includes(k.id)),
        newCards: cards.filter((c) => transfer.cardIds.includes(c.cardId)),
        existingLoans: transfer.existingLoans,
        contact: tenantContactCodes[0],
        contact2: tenantContactCodes[1],
        onOpenChange: (open: boolean) => setTransfer((t) => ({ ...t, open })),
        onSuccess: async (receiptId?: string) => {
          await refreshStatuses()
          clearSelection()
          if (receiptId) setReceipt({ open: true, receiptId })
          else onKeysLoaned?.()
        },
      },
      return: {
        open: ret.open,
        keyIds: ret.keyIds,
        cardIds: ret.cardIds,
        leaseEndDate: lease.leaseEndDate,
        onOpenChange: (open: boolean) => setRet((r) => ({ ...r, open })),
        onSuccess: async () => {
          await refreshStatuses()
          clearSelection()
          onKeysReturned?.()
        },
      },
    },
  }
}
