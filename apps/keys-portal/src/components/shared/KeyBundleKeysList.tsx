import { useMemo } from 'react'
import {
  TableCell,
  TableHead,
  TableRow,
  TableLink,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CollapsibleGroupTable,
  type TableSelectionProps,
} from './tables/CollapsibleGroupTable'
import { DefaultLoanHeader } from './tables/DefaultLoanHeader'
import { LoanActionMenu } from '@/components/loan/LoanActionMenu'
import {
  KeyTypeBadge,
  KeyEventBadge,
  PickupAvailabilityBadge,
  getLatestActiveEvent,
} from './tables/StatusBadges'
import type { KeyDetails } from '@/services/types'
import { getActiveLoan, getLatestLoan } from '@/utils/loanHelpers'

interface KeyBundleKeysListProps {
  /** Flat array of keys to display */
  keys: KeyDetails[]
  companyNames: Record<string, string>
  selectable?: boolean
  selectedKeys?: string[]
  onKeySelectionChange?: (keyId: string, checked: boolean) => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
  onRefresh?: () => void
  onReturn?: (keyIds: string[], cardIds: string[]) => void
}

/**
 * Component for displaying keys in key bundles, grouped by contact and loan with collapsible headers.
 * Can optionally include checkboxes for key selection.
 *
 * Receives a flat array of keys and uses CollapsibleGroupTable to handle
 * grouping by contact/loan and collapse behavior.
 */
export function KeyBundleKeysList({
  keys,
  companyNames,
  selectable = false,
  selectedKeys = [],
  onKeySelectionChange,
  onSelectAll,
  onDeselectAll,
  onRefresh,
  onReturn,
}: KeyBundleKeysListProps) {
  // Build URL for key details page
  const getKeyUrl = (key: KeyDetails) => {
    const disposed = key.disposed ? 'true' : 'false'
    const params = new URLSearchParams({
      disposed,
      editKeyId: key.id,
    })
    if (key.rentalObjectCode) {
      params.set('rentalObjectCode', key.rentalObjectCode)
    }
    return `/Keys?${params.toString()}`
  }

  const columnCount = selectable ? 9 : 8

  // Calculate selection state for header checkbox
  const allKeyIds = useMemo(() => keys.map((key) => key.id), [keys])
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const allSelected =
    allKeyIds.length > 0 && allKeyIds.every((id) => selectedSet.has(id))
  const someSelected = selectedKeys.length > 0
  const isIndeterminate = someSelected && !allSelected

  // Bridge into TableSelectionProps
  const selection: TableSelectionProps | undefined = selectable
    ? {
        isSelected: (id) => selectedSet.has(id),
        toggle: (id) => {
          const checked = !selectedSet.has(id)
          onKeySelectionChange?.(id, checked)
        },
      }
    : undefined

  return (
    <CollapsibleGroupTable
      items={keys}
      getItemId={(key) => key.id}
      columnCount={columnCount}
      selection={selection}
      // Group by contact code (from latest loan - active or previous)
      // Use special marker for never-loaned keys so they get a group header too
      groupBy={(key) => {
        const latestLoan = getLatestLoan(key)
        return latestLoan?.contact || '__never_loaned__'
      }}
      // Section by loan status
      sectionBy={(key) => {
        const activeLoan = getActiveLoan(key)
        return activeLoan ? 'loaned' : 'unloaned'
      }}
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
          <TableHead className="w-[18%]">Nyckelnamn</TableHead>
          <TableHead className="w-[6%]">Löpnr</TableHead>
          <TableHead className="w-[6%]">Flex</TableHead>
          <TableHead className="w-[10%]">Låssystem</TableHead>
          <TableHead className="w-[12%]">Typ</TableHead>
          <TableHead className="w-[12%]">Status</TableHead>
          <TableHead className="w-[18%]">Utlämning</TableHead>
          <TableHead className="w-[18%]">Hyresobjekt</TableHead>
        </TableRow>
      )}
      renderRow={(key, { isSelected, onToggleSelect, indent }) => (
        <TableRow key={key.id} className="bg-background h-12">
          {selectable && (
            <TableCell className={`w-[50px] ${indent ? 'pl-8' : ''}`}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect()}
              />
            </TableCell>
          )}
          <TableCell
            className={`w-[18%] ${!selectable && indent ? 'pl-8' : ''}`}
          >
            <TableLink to={getKeyUrl(key)}>{key.keyName}</TableLink>
          </TableCell>
          <TableCell className="w-[6%]">
            {key.keySequenceNumber ?? '-'}
          </TableCell>
          <TableCell className="w-[6%]">{key.flexNumber ?? '-'}</TableCell>
          <TableCell className="w-[10%]">
            {key.keySystem?.systemCode || '-'}
          </TableCell>
          <TableCell className="w-[12%]">
            <KeyTypeBadge keyType={key.keyType} />
          </TableCell>
          <TableCell className="w-[12%]">
            {getLatestActiveEvent(key) ? (
              <KeyEventBadge event={getLatestActiveEvent(key)} />
            ) : (
              '-'
            )}
          </TableCell>
          <TableCell className="w-[18%]">
            <PickupAvailabilityBadge itemData={key} />
          </TableCell>
          <TableCell className="w-[18%]">
            {key.rentalObjectCode ?? '-'}
          </TableCell>
        </TableRow>
      )}
      renderGroupHeader={(contactCode, items) => {
        // Handle keys that have never been loaned
        if (contactCode === '__never_loaned__') {
          return (
            <span className="font-semibold text-muted-foreground">
              Aldrig utlånad
            </span>
          )
        }

        // Show the contact name and latest loan details
        const firstKey = items[0]
        const latestLoan = getLatestLoan(firstKey)

        return (
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                {companyNames[contactCode] || contactCode}
              </span>
              {latestLoan && <DefaultLoanHeader loan={latestLoan} />}
            </div>
            {latestLoan && (
              <div onClick={(e) => e.stopPropagation()}>
                <LoanActionMenu
                  loan={latestLoan}
                  onRefresh={onRefresh}
                  onReturn={onReturn}
                />
              </div>
            )}
          </div>
        )
      }}
      renderSectionHeader={(section) => {
        if (section === 'loaned') {
          return null // Loaned items are grouped by contact, no top-level section header needed
        }
        return <span className="font-semibold">Ej utlånade</span>
      }}
    />
  )
}
