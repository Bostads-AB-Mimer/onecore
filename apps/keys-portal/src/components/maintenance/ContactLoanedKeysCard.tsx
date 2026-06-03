import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Key } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  TableCell,
  TableHead,
  TableRow,
  TableLink,
} from '@/components/ui/table'
import {
  CollapsibleGroupTable,
  type RowRenderProps,
} from '@/components/shared/tables/CollapsibleGroupTable'
import { DefaultLoanHeader } from '@/components/shared/tables/DefaultLoanHeader'
import {
  KeyTypeBadge,
  KeyEventBadge,
  getLatestActiveEvent,
} from '@/components/shared/tables/StatusBadges'
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
  KeyDetails,
  KeyLoanWithDetails,
  KeyLoan,
} from '@/services/types'

type LoanedKeyItem = {
  key: KeyDetails
  bundleId: string | null
  bundleName: string | null
  loanId: string | null
  loan: KeyLoan | null
}

type Props = {
  contactCode: string
  activeLoans: KeyLoanWithDetails[]
  loansKeySystemMap: Record<string, string>
  onBundleClick: (bundleId: string) => void
  /** Refresh the parent's loans after a return/dispose here. */
  onChanged?: () => void
}

const COLUMN_COUNT = 8

export function ContactLoanedKeysCard({
  contactCode,
  activeLoans,
  loansKeySystemMap,
  onBundleClick,
  onChanged,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
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

  // Fetch bundles and their keys on expand
  useEffect(() => {
    if (!isOpen || hasLoaded) return

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
  }, [isOpen, hasLoaded, contactCode])

  // Build unified items list
  const items = useMemo<LoanedKeyItem[]>(() => {
    // Bundled keys
    const bundledItems: LoanedKeyItem[] = []
    const bundledKeyIds = new Set<string>()

    Object.entries(bundleKeys).forEach(([bundleId, keys]) => {
      sortKeys(keys).forEach((key) => {
        bundledItems.push({
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
    const unbundledItems: LoanedKeyItem[] = []
    const seenKeyIds = new Set<string>()

    activeLoans.forEach((loan) => {
      sortKeys(loan.keysArray || []).forEach((key) => {
        if (!bundledKeyIds.has(key.id) && !seenKeyIds.has(key.id)) {
          seenKeyIds.add(key.id)
          unbundledItems.push({
            key,
            bundleId: null,
            bundleName: null,
            loanId: loan.id,
            loan: loan as KeyLoan,
          })
        }
      })
    })

    return [...bundledItems, ...unbundledItems]
  }, [bundleKeys, bundleNameMap, activeLoans])

  const totalCount = items.length
  const allKeys = useMemo(() => items.map((i) => i.key), [items])

  // Refetch this card's bundles and tell the parent to refresh its loans.
  const refresh = () => {
    setHasLoaded(false)
    onChanged?.()
  }

  const handleDispose = async () => {
    setIsProcessing(true)
    const ok = await disposeWithUndo(selection.selectedIds, { onChanged: refresh })
    if (ok) selection.deselectAll()
    setIsProcessing(false)
  }

  const getKeyUrl = (key: KeyDetails) => {
    const params = new URLSearchParams({
      disposed: key.disposed ? 'true' : 'false',
      editKeyId: key.id,
    })
    if (key.rentalObjectCode) {
      params.set('rentalObjectCode', key.rentalObjectCode)
    }
    return `/Keys?${params.toString()}`
  }

  const allSelected =
    allKeys.length > 0 && allKeys.every((k) => selection.isSelected(k.id))
  const selectedCount = selection.selectedIds.length

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle className="text-base">
              Utlånade nycklar
              {hasLoaded && totalCount > 0 && ` (${totalCount})`}
            </CardTitle>
          </div>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isOpen && (
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
                  selectedCount={selectedCount}
                  isProcessing={isProcessing}
                  returnAction={
                    selectedCount > 0
                      ? {
                          label: 'Återlämna',
                          count: selectedCount,
                          onClick: () => setShowReturnDialog(true),
                        }
                      : undefined
                  }
                  disposeAction={
                    selectedCount > 0
                      ? { label: 'Kassera', onClick: handleDispose }
                      : undefined
                  }
                />
              </div>

              <CollapsibleGroupTable
                items={items}
                getItemId={(item) => item.key.id}
                columnCount={COLUMN_COUNT}
                selection={{
                  isSelected: (id) => selection.isSelected(id),
                  toggle: (id) =>
                    selection.isSelected(id)
                      ? selection.deselect(id)
                      : selection.select(id),
                }}
                sectionBy={(item) => (item.bundleId ? 'bundled' : 'unbundled')}
                sectionOrder={['bundled', 'unbundled']}
                groupBy={(item) => item.bundleId || item.loanId || null}
                initialExpanded="all"
                renderSectionHeader={(section, sectionItems) => {
                  if (section === 'bundled') {
                    return <span>Samlingar ({sectionItems.length} nycklar)</span>
                  }
                  if (section === 'unbundled') {
                    return (
                      <span>Saknar samling ({sectionItems.length} nycklar)</span>
                    )
                  }
                  return null
                }}
                renderGroupHeader={(groupKey, groupItems) => {
                  const firstItem = groupItems[0]

                  // Bundle group
                  if (firstItem.bundleId) {
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

                  // Loan group (unbundled)
                  if (firstItem.loan) {
                    return <DefaultLoanHeader loan={firstItem.loan} />
                  }

                  return null
                }}
                renderHeader={() => (
                  <TableRow className="bg-background">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          checked
                            ? selection.selectAll(allKeys.map((k) => k.id))
                            : selection.deselectAll()
                        }
                        aria-label="Markera alla"
                      />
                    </TableHead>
                    <TableHead className="w-[22%]">Nyckelnamn</TableHead>
                    <TableHead className="w-[8%]">Löpnr</TableHead>
                    <TableHead className="w-[8%]">Flex</TableHead>
                    <TableHead className="w-[15%]">Låssystem</TableHead>
                    <TableHead className="w-[12%]">Typ</TableHead>
                    <TableHead className="w-[15%]">Hyresobjekt</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                  </TableRow>
                )}
                renderRow={(
                  item: LoanedKeyItem,
                  { indent, isSelected, onToggleSelect }: RowRenderProps
                ) => (
                  <TableRow key={item.key.id} className="bg-background h-12">
                    <TableCell className="w-[40px]">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={onToggleSelect}
                        aria-label={`Markera ${item.key.keyName}`}
                      />
                    </TableCell>
                    <TableCell className={`w-[22%] ${indent ? 'pl-8' : ''}`}>
                      <TableLink to={getKeyUrl(item.key)}>
                        {item.key.keyName}
                      </TableLink>
                    </TableCell>
                    <TableCell className="w-[8%]">
                      {item.key.keySequenceNumber ?? '-'}
                    </TableCell>
                    <TableCell className="w-[8%]">
                      {item.key.flexNumber ?? '-'}
                    </TableCell>
                    <TableCell className="w-[15%]">
                      {item.key.keySystem?.systemCode ||
                        (item.key.keySystemId
                          ? loansKeySystemMap[item.key.keySystemId] || '-'
                          : '-')}
                    </TableCell>
                    <TableCell className="w-[12%]">
                      <KeyTypeBadge keyType={item.key.keyType} />
                    </TableCell>
                    <TableCell className="w-[15%]">
                      {item.key.rentalObjectCode ?? '-'}
                    </TableCell>
                    <TableCell className="w-[12%]">
                      {getLatestActiveEvent(item.key) ? (
                        <KeyEventBadge event={getLatestActiveEvent(item.key)} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                )}
              />
            </>
          )}
        </CardContent>
      )}

      <ReturnKeysDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        keyIds={selection.selectedIds}
        allKeys={allKeys}
        onSuccess={() => {
          selection.deselectAll()
          refresh()
        }}
      />
    </Card>
  )
}
