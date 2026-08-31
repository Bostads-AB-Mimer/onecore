import { useState, useEffect, useMemo } from 'react'
import { Key } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CollapsibleGroupTable } from '@/components/shared/tables/CollapsibleGroupTable'
import { DefaultLoanHeader } from '@/components/shared/tables/DefaultLoanHeader'
import {
  loanableItemColumns,
  nameColumn,
  seqColumn,
  flexColumn,
  systemColumn,
  typeColumn,
  statusColumn,
  disposedColumn,
} from '@/components/shared/tables/loanableItemColumns'
import { itemTableSelection } from '@/components/shared/tables/itemTableSelection'
import { KeyActionButtons } from '@/components/shared/KeyActionButtons'
import { ReturnKeysDialog } from '@/components/loan/dialogs/ReturnKeysDialog'
import { useItemSelection } from '@/hooks/useItemSelection'
import { useDisposeWithUndo } from '@/hooks/useDisposeWithUndo'
import {
  getBundlesByContactWithLoanedKeys,
  getKeyBundleDetails,
} from '@/services/api/keyBundleService'
import { sortKeys } from '@/utils/sortKeys'
import type {
  BundleWithLoanedKeysInfo,
  Card as CardData,
  KeyDetails,
  KeyLoanWithDetails,
  KeyLoan,
} from '@/services/types'

type LoanedItem =
  | {
      itemType: 'key'
      key: KeyDetails
      bundleId: string | null
      bundleName: string | null
      loanId: string | null
      loan: KeyLoan | null
    }
  | {
      itemType: 'card'
      card: CardData
      loanId: string
      loan: KeyLoan
    }

type Props = {
  contactCode: string
  activeLoans: KeyLoanWithDetails[]
  loansKeySystemMap: Record<string, string>
  onBundleClick: (bundleId: string) => void
  /** Refresh the parent's loans after a return/dispose here. */
  onChanged?: () => void
}

export function ContactLoanedKeys({
  contactCode,
  activeLoans,
  loansKeySystemMap,
  onBundleClick,
  onChanged,
}: Props) {
  const [bundles, setBundles] = useState<BundleWithLoanedKeysInfo[]>([])
  const [bundleKeys, setBundleKeys] = useState<Record<string, KeyDetails[]>>({})
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showReturnDialog, setShowReturnDialog] = useState(false)

  const selection = useItemSelection()
  const disposeWithUndo = useDisposeWithUndo()
  const [isProcessing, setIsProcessing] = useState(false)

  // Bundle name lookup
  const bundleNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    bundles.forEach((b) => {
      map[b.id] = b.name
    })
    return map
  }, [bundles])

  // Fetch bundles and their keys
  useEffect(() => {
    if (hasLoaded) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const bundleList = await getBundlesByContactWithLoanedKeys(contactCode)
        setBundles(bundleList)

        // Fetch keys for all bundles in parallel
        const keysByBundle: Record<string, KeyDetails[]> = {}
        await Promise.all(
          bundleList.map(async (bundle) => {
            try {
              const data = await getKeyBundleDetails(bundle.id, {
                includeLoans: true,
              })
              if (data) {
                // Filter to keys loaned to this contact
                const loaned = data.keys.filter((key) =>
                  key.loans?.some(
                    (loan) =>
                      loan.loanType === 'MAINTENANCE' &&
                      loan.contact === contactCode &&
                      !loan.returnedAt
                  )
                )
                keysByBundle[bundle.id] = loaned
              }
            } catch (error) {
              console.error(
                `Error fetching bundle ${bundle.id} details:`,
                error
              )
            }
          })
        )
        setBundleKeys(keysByBundle)
        setHasLoaded(true)
      } catch (error) {
        console.error('Error fetching bundles with loaned keys:', error)
        setHasLoaded(true)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [hasLoaded, contactCode])

  // Build unified items list
  const items = useMemo<LoanedItem[]>(() => {
    // Bundled keys
    const bundledItems: LoanedItem[] = []
    const bundledKeyIds = new Set<string>()

    Object.entries(bundleKeys).forEach(([bundleId, keys]) => {
      sortKeys(keys).forEach((key) => {
        bundledItems.push({
          itemType: 'key',
          key,
          bundleId,
          bundleName: bundleNameMap[bundleId] || bundleId,
          loanId: null,
          loan: null,
        })
        bundledKeyIds.add(key.id)
      })
    })

    // Unbundled keys from active loans
    const unbundledItems: LoanedItem[] = []
    const seenKeyIds = new Set<string>()

    activeLoans.forEach((loan) => {
      sortKeys(loan.keysArray || []).forEach((key) => {
        if (!bundledKeyIds.has(key.id) && !seenKeyIds.has(key.id)) {
          seenKeyIds.add(key.id)
          unbundledItems.push({
            itemType: 'key',
            key,
            bundleId: null,
            bundleName: null,
            loanId: loan.id,
            loan: loan as KeyLoan,
          })
        }
      })
    })

    // Cards from active loans — never bundled, grouped under their loan
    const cardItems: LoanedItem[] = []
    const seenCardIds = new Set<string>()

    activeLoans.forEach((loan) => {
      ;(loan.keyCardsArray || []).forEach((card) => {
        if (!seenCardIds.has(card.cardId)) {
          seenCardIds.add(card.cardId)
          cardItems.push({
            itemType: 'card',
            card,
            loanId: loan.id,
            loan: loan as KeyLoan,
          })
        }
      })
    })

    return [...bundledItems, ...unbundledItems, ...cardItems]
  }, [bundleKeys, bundleNameMap, activeLoans])

  const totalCount = items.length
  const allKeys = useMemo(
    () => items.flatMap((i) => (i.itemType === 'key' ? [i.key] : [])),
    [items]
  )
  const allCards = useMemo(
    () => items.flatMap((i) => (i.itemType === 'card' ? [i.card] : [])),
    [items]
  )
  // Keys and cards share one selection; cards are return-only, dispose is keys-only.
  const t = itemTableSelection(selection, {
    keyIds: allKeys.map((k) => k.id),
    cardIds: allCards.map((c) => c.cardId),
  })

  // Refetch this card's bundles and tell the parent to refresh its loans.
  const refresh = () => {
    setHasLoaded(false)
    onChanged?.()
  }

  const handleDispose = async () => {
    setIsProcessing(true)
    const ok = await disposeWithUndo(t.selectedKeyIds, { onChanged: refresh })
    if (ok) selection.deselectAll()
    setIsProcessing(false)
  }

  const columns = loanableItemColumns({
    checkboxWidth: 'w-[40px]',
    columns: [
      nameColumn({ width: 'w-[22%]', label: 'Nyckelnamn' }),
      seqColumn({ width: 'w-[8%]' }),
      flexColumn({ width: 'w-[8%]' }),
      systemColumn({
        width: 'w-[15%]',
        label: (key) =>
          key.keySystem?.systemCode ||
          (key.keySystemId ? loansKeySystemMap[key.keySystemId] || '-' : '-'),
      }),
      typeColumn({ width: 'w-[12%]' }),
      {
        header: 'Hyresobjekt',
        width: 'w-[15%]',
        key: (key) => key.rentalObjectCode ?? '-',
        card: () => '-',
      },
      statusColumn,
      disposedColumn,
    ],
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          <CardTitle className="text-base">
            Utlånade nycklar
            {hasLoaded && totalCount > 0 && ` (${totalCount})`}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Spinner centered />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Inga utlånade nycklar till denna kontakt
          </p>
        ) : (
          <>
            <div className="mb-4">
              <KeyActionButtons
                selectedCount={t.selectedCount}
                isProcessing={isProcessing}
                returnAction={
                  t.selectedCount > 0
                    ? {
                        label: 'Återlämna',
                        count: t.selectedCount,
                        onClick: () => setShowReturnDialog(true),
                      }
                    : undefined
                }
                disposeAction={
                  t.selectedKeyIds.length > 0 && t.selectedCardIds.length === 0
                    ? { label: 'Kassera', onClick: handleDispose }
                    : undefined
                }
              />
            </div>

            <CollapsibleGroupTable
              items={items}
              getItemId={(item) =>
                item.itemType === 'key' ? item.key.id : item.card.cardId
              }
              columnCount={columns.columnCount}
              selection={t.selection}
              sectionBy={(item) =>
                item.itemType === 'key' && item.bundleId
                  ? 'bundled'
                  : 'unbundled'
              }
              sectionOrder={['bundled', 'unbundled']}
              groupBy={(item) =>
                item.itemType === 'key'
                  ? item.bundleId || item.loanId || null
                  : item.loanId
              }
              initialExpanded="all"
              renderSectionHeader={(section, sectionItems) => {
                if (section === 'bundled') {
                  return <span>Samlingar ({sectionItems.length} nycklar)</span>
                }
                if (section === 'unbundled') {
                  return (
                    <span>Saknar samling ({sectionItems.length} objekt)</span>
                  )
                }
                return null
              }}
              renderGroupHeader={(_groupKey, groupItems) => {
                const firstItem = groupItems[0]

                // Bundle group
                if (firstItem.itemType === 'key' && firstItem.bundleId) {
                  return (
                    <div className="flex items-center justify-between flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {firstItem.bundleName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {groupItems.length} nycklar
                        </Badge>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onBundleClick(firstItem.bundleId!)
                        }}
                        className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors shrink-0"
                      >
                        Visa samling
                      </button>
                    </div>
                  )
                }

                // Loan group (unbundled keys and cards)
                if (firstItem.loan) {
                  return <DefaultLoanHeader loan={firstItem.loan} />
                }

                return null
              }}
              renderHeader={() => columns.header(t.header)}
              renderRow={(item, state) =>
                item.itemType === 'card'
                  ? columns.cardRow(item.card, state)
                  : columns.keyRow(item.key, state)
              }
            />
          </>
        )}
      </CardContent>

      <ReturnKeysDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        keyIds={t.selectedKeyIds}
        cardIds={t.selectedCardIds}
        allKeys={allKeys}
        allCards={allCards}
        onSuccess={() => {
          selection.deselectAll()
          refresh()
        }}
      />
    </Card>
  )
}
