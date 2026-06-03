import { useMemo } from 'react'
import {
  CollapsibleGroupTable,
  type TableSelectionProps,
} from '@/components/shared/tables/CollapsibleGroupTable'
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
import { LoanActionMenu } from './LoanActionMenu'
import { PickupAvailabilityBadge } from '@/components/shared/tables/StatusBadges'
import type { KeyDetails, CardDetails, Lease } from '@/services/types'
import { getActiveLoan, getLatestLoan } from '@/utils/loanHelpers'

type LeaseItem =
  | { itemType: 'key'; data: KeyDetails }
  | { itemType: 'card'; data: CardDetails }

interface LeaseItemsListProps {
  keys: KeyDetails[]
  cards: CardDetails[]
  lease: Lease
  selectable?: boolean
  selectedKeys?: string[]
  selectedCards?: string[]
  onKeySelectionChange?: (keyId: string, checked: boolean) => void
  onCardSelectionChange?: (cardId: string, checked: boolean) => void
  onRefresh?: () => void
  onReturn?: (keyIds: string[], cardIds: string[]) => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
}

export function LeaseItemsList({
  keys,
  cards,
  lease,
  selectable = true,
  selectedKeys = [],
  selectedCards = [],
  onKeySelectionChange,
  onCardSelectionChange,
  onRefresh,
  onReturn,
  onSelectAll,
  onDeselectAll,
}: LeaseItemsListProps) {
  const items: LeaseItem[] = useMemo(() => {
    const keyItems: LeaseItem[] = keys.map((k) => ({
      itemType: 'key',
      data: k,
    }))
    const cardItems: LeaseItem[] = cards.map((c) => ({
      itemType: 'card',
      data: c,
    }))
    return [...keyItems, ...cardItems]
  }, [keys, cards])

  const leaseContactCodes = useMemo(
    () => (lease.tenants ?? []).map((t) => t.contactCode).filter(Boolean),
    [lease]
  )

  // Calculate selection state for header checkbox
  const allItemIds = useMemo(
    () =>
      items.map((item) =>
        item.itemType === 'key' ? item.data.id : item.data.cardId
      ),
    [items]
  )
  const selectedIds = [...selectedKeys, ...selectedCards]
  const allSelected =
    allItemIds.length > 0 && allItemIds.every((id) => selectedIds.includes(id))
  const someSelected = selectedIds.length > 0
  const isIndeterminate = someSelected && !allSelected

  // Bridge dual key/card selection into a single TableSelectionProps
  const keyIdSet = useMemo(() => new Set(keys.map((k) => k.id)), [keys])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selection: TableSelectionProps | undefined = selectable
    ? {
        isSelected: (id) => selectedSet.has(id),
        toggle: (id) => {
          const isKey = keyIdSet.has(id)
          const checked = !selectedSet.has(id)
          if (isKey) {
            onKeySelectionChange?.(id, checked)
          } else {
            onCardSelectionChange?.(id, checked)
          }
        },
      }
    : undefined

  const columns = loanableItemColumns({
    checkboxWidth: 'w-[50px]',
    selectable,
    columns: [
      nameColumn({ width: 'w-[18%]' }),
      seqColumn({ width: 'w-[6%]' }),
      flexColumn({ width: 'w-[6%]' }),
      systemColumn({ width: 'w-[10%]' }),
      typeColumn({ width: 'w-[12%]' }),
      statusColumn,
      {
        header: 'Utlämning',
        width: 'w-[18%]',
        key: (key) => <PickupAvailabilityBadge itemData={key} />,
        card: (card) => <PickupAvailabilityBadge itemData={card} />,
      },
      disposedColumn,
    ],
  })

  return (
    <CollapsibleGroupTable
      items={items}
      getItemId={(item) =>
        item.itemType === 'key' ? item.data.id : item.data.cardId
      }
      columnCount={columns.columnCount}
      selection={selection}
      groupBy={(item) => getLatestLoan(item.data)?.id || '__never_loaned__'}
      sectionBy={(item) => (getActiveLoan(item.data) ? 'loaned' : 'unloaned')}
      sectionOrder={['loaned', 'unloaned']}
      renderHeader={() =>
        columns.header({
          checked: isIndeterminate ? 'indeterminate' : allSelected,
          onCheckedChange: () =>
            allSelected ? onDeselectAll?.() : onSelectAll?.(),
        })
      }
      renderRow={(item, state) =>
        item.itemType === 'card'
          ? columns.cardRow(item.data, state)
          : columns.keyRow(item.data, state)
      }
      renderGroupHeader={(loanId, groupItems) => {
        if (loanId === '__never_loaned__') {
          return (
            <span className="font-semibold text-muted-foreground">
              Aldrig utlånad
            </span>
          )
        }
        const latestLoan = groupItems[0].data.loans?.find(
          (l) => l.id === loanId
        )
        return latestLoan ? (
          <div className="flex items-center justify-between flex-1">
            <DefaultLoanHeader
              loan={latestLoan}
              leaseContactCodes={leaseContactCodes}
            />
            <div onClick={(e) => e.stopPropagation()}>
              <LoanActionMenu
                loan={latestLoan}
                onRefresh={onRefresh}
                onReturn={
                  onReturn
                    ? () => {
                        const keyIds: string[] = []
                        const cardIds: string[] = []
                        for (const item of groupItems) {
                          if (item.itemType === 'key') keyIds.push(item.data.id)
                          else cardIds.push(item.data.cardId)
                        }
                        onReturn(keyIds, cardIds)
                      }
                    : undefined
                }
              />
            </div>
          </div>
        ) : null
      }}
      renderSectionHeader={(section) =>
        section === 'loaned' ? null : (
          <span className="font-semibold">Ej utlånade</span>
        )
      }
    />
  )
}
