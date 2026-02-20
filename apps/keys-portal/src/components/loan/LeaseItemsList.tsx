import React, { useMemo, useState } from 'react'
import {
  TableCell,
  TableHead,
  TableRow,
  TableLink,
  TableExternalLink,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CollapsibleGroupTable,
  type TableSelectionProps,
} from '@/components/shared/tables/CollapsibleGroupTable'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { DefaultLoanHeader } from '@/components/shared/tables/DefaultLoanHeader'
import { LoanActionMenu } from './LoanActionMenu'
import {
  KeyEventBadge,
  PickupAvailabilityBadge,
  ItemTypeBadge,
  ItemDisposedBadge,
  getLatestActiveEvent,
} from '@/components/shared/tables/StatusBadges'
import type { KeyDetails, CardDetails, Lease } from '@/services/types'
import { getActiveLoan, getLatestLoan } from '@/utils/loanHelpers'
import { extractCardOwnerId, getCardOwnerLink } from '@/utils/externalLinks'

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
  const getKeyUrl = (key: KeyDetails) => {
    const params = new URLSearchParams({
      disposed: key.disposed ? 'true' : 'false',
      editKeyId: key.id,
    })
    if (key.rentalObjectCode)
      params.set('rentalObjectCode', key.rentalObjectCode)
    return `/Keys?${params.toString()}`
  }

  const items: LeaseItem[] = useMemo(() => {
    const keyItems: LeaseItem[] = keys
      .filter((k) => !k.disposed || getActiveLoan(k))
      .map((k) => ({ itemType: 'key', data: k }))
    const cardItems: LeaseItem[] = cards
      .filter((c) => !c.disabled || getActiveLoan(c))
      .map((c) => ({ itemType: 'card', data: c }))
    return [...keyItems, ...cardItems]
  }, [keys, cards])

  const columnCount = selectable ? 9 : 8

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

  return (
    <CollapsibleGroupTable
      items={items}
      getItemId={(item) =>
        item.itemType === 'key' ? item.data.id : item.data.cardId
      }
      columnCount={columnCount}
      selection={selection}
      groupBy={(item) => getLatestLoan(item.data)?.id || '__never_loaned__'}
      sectionBy={(item) => (getActiveLoan(item.data) ? 'loaned' : 'unloaned')}
      sectionOrder={['loaned', 'unloaned']}
      renderHeader={() => (
        <TableRow className="bg-background">
          {selectable && (
            <TableHead className="w-[50px] pl-8">
              <Checkbox
                checked={isIndeterminate ? 'indeterminate' : allSelected}
                onCheckedChange={() => {
                  if (allSelected) {
                    onDeselectAll?.()
                  } else {
                    onSelectAll?.()
                  }
                }}
              />
            </TableHead>
          )}
          <TableHead className="w-[18%]">Namn</TableHead>
          <TableHead className="w-[6%]">Löpnr</TableHead>
          <TableHead className="w-[6%]">Flex</TableHead>
          <TableHead className="w-[10%]">Låssystem</TableHead>
          <TableHead className="w-[12%]">Typ</TableHead>
          <TableHead className="w-[12%]">Status</TableHead>
          <TableHead className="w-[18%]">Utlämning</TableHead>
          <TableHead className="w-[10%]">Kassering</TableHead>
        </TableRow>
      )}
      renderRow={(item, { isSelected, onToggleSelect, indent }) =>
        item.itemType === 'card' ? (
          <CardRow
            key={item.data.cardId}
            card={item.data}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            indent={indent}
            selectable={selectable}
            columnCount={columnCount}
          />
        ) : (
          <TableRow key={item.data.id} className="bg-background h-12">
            {selectable && (
              <TableCell className={`w-[50px] ${indent ? 'pl-8' : ''}`}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onToggleSelect}
                />
              </TableCell>
            )}
            <TableCell
              className={`w-[18%] ${!selectable && indent ? 'pl-8' : ''}`}
            >
              <TableLink to={getKeyUrl(item.data)}>
                {item.data.keyName}
              </TableLink>
            </TableCell>
            <TableCell className="w-[6%]">
              {item.data.keySequenceNumber ?? '-'}
            </TableCell>
            <TableCell className="w-[6%]">
              {item.data.flexNumber ?? '-'}
            </TableCell>
            <TableCell className="w-[10%]">
              {item.data.keySystem?.systemCode || '-'}
            </TableCell>
            <TableCell className="w-[12%]">
              <ItemTypeBadge itemType={item.data.keyType} />
            </TableCell>
            <TableCell className="w-[12%]">
              {getLatestActiveEvent(item.data) ? (
                <KeyEventBadge event={getLatestActiveEvent(item.data)} />
              ) : (
                '-'
              )}
            </TableCell>
            <TableCell className="w-[18%]">
              <PickupAvailabilityBadge itemData={item.data} />
            </TableCell>
            <TableCell className="w-[10%]">
              <ItemDisposedBadge isDisposed={!!item.data.disposed} />
            </TableCell>
          </TableRow>
        )
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
            <DefaultLoanHeader loan={latestLoan} />
            <div onClick={(e) => e.stopPropagation()}>
              <LoanActionMenu
                loan={latestLoan}
                lease={lease}
                onRefresh={onRefresh}
                onReturn={onReturn}
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

function CardRow({
  card,
  isSelected,
  onToggleSelect,
  indent,
  selectable,
  columnCount,
}: {
  card: CardDetails
  isSelected: boolean
  onToggleSelect: () => void
  indent: boolean
  selectable: boolean
  columnCount: number
}) {
  const [expanded, setExpanded] = useState(false)
  const hasCodes = card.codes && card.codes.length > 0
  const ownerId = extractCardOwnerId(card.owner)
  const ownerLink = ownerId ? getCardOwnerLink(ownerId) : null

  return (
    <React.Fragment>
      <TableRow className="bg-background h-12">
        {selectable && (
          <TableCell className={`w-[50px] ${indent ? 'pl-8' : ''}`}>
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          </TableCell>
        )}
        <TableCell className={`w-[18%] ${!selectable && indent ? 'pl-8' : ''}`}>
          <div className="flex items-center gap-2">
            {hasCodes && (
              <ExpandButton
                isExpanded={expanded}
                onClick={() => setExpanded(!expanded)}
              />
            )}
            <TableExternalLink
              href={ownerLink}
              onClick={(e) => e.stopPropagation()}
            >
              {card.name || card.cardId}
            </TableExternalLink>
          </div>
        </TableCell>
        <TableCell className="w-[6%]">-</TableCell>
        <TableCell className="w-[6%]">-</TableCell>
        <TableCell className="w-[10%]">-</TableCell>
        <TableCell className="w-[12%]">
          <ItemTypeBadge itemType="CARD" />
        </TableCell>
        <TableCell className="w-[12%]">-</TableCell>
        <TableCell className="w-[18%]">
          <PickupAvailabilityBadge itemData={card} />
        </TableCell>
        <TableCell className="w-[10%]">
          <ItemDisposedBadge isDisposed={!!card.disabled} isCard />
        </TableCell>
      </TableRow>
      {expanded &&
        hasCodes &&
        card.codes!.map((code: { format?: string; number?: string }, idx) => (
          <TableRow key={idx} className="bg-muted/30">
            <TableCell colSpan={columnCount} className="py-2 pl-16 text-sm">
              <span className="font-mono text-xs text-muted-foreground mr-4">
                {code.format || '-'}
              </span>
              <span className="font-mono font-medium">
                {code.number || JSON.stringify(code)}
              </span>
            </TableCell>
          </TableRow>
        ))}
    </React.Fragment>
  )
}
