import { useMemo } from 'react'
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
import type { ItemTableSelection } from '@/components/shared/tables/itemTableSelection'
import { LoanActionMenu } from './LoanActionMenu'
import { PickupAvailabilityBadge } from '@/components/shared/tables/StatusBadges'
import type { KeyDetails, CardDetails, Lease } from '@/services/types'
import { getActiveLoan, getLatestLoan } from '@/utils/loanHelpers'

type LeaseItem =
  | { itemType: 'key'; data: KeyDetails }
  | { itemType: 'card'; data: CardDetails }

interface LeaseKeysTableProps {
  keys: KeyDetails[]
  cards: CardDetails[]
  lease: Lease
  selectable?: boolean
  /** Selection bindings from itemTableSelection (required when selectable). */
  selection?: ItemTableSelection
  onRefresh?: () => void
  onReturn?: (keyIds: string[], cardIds: string[]) => void
}

export function LeaseKeysTable({
  keys,
  cards,
  lease,
  selectable = true,
  selection,
  onRefresh,
  onReturn,
}: LeaseKeysTableProps) {
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
      selection={selection?.selection}
      groupBy={(item) => getLatestLoan(item.data)?.id || '__never_loaned__'}
      sectionBy={(item) => (getActiveLoan(item.data) ? 'loaned' : 'unloaned')}
      sectionOrder={['loaned', 'unloaned']}
      renderHeader={() => columns.header(selection?.header)}
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
