import { useMemo } from 'react'
import {
  CollapsibleGroupTable,
  type TableSelectionProps,
} from './tables/CollapsibleGroupTable'
import { DefaultLoanHeader } from './tables/DefaultLoanHeader'
import { LoanActionMenu } from '@/components/loan/LoanActionMenu'
import {
  loanableItemColumns,
  nameColumn,
  seqColumn,
  flexColumn,
  systemColumn,
  typeColumn,
  statusColumn,
} from './tables/loanableItemColumns'
import { PickupAvailabilityBadge } from './tables/StatusBadges'
import type {
  ContactV1,
  KeyDetails,
  KeyLoanWithDetails,
} from '@/services/types'
import { getActiveLoan, getLatestLoan } from '@/utils/loanHelpers'
import {
  getContactFullName,
  getContactRegistrationNumber,
} from '@/services/api/contactService'

interface KeyBundleKeysListProps {
  /** Flat array of keys to display */
  keys: KeyDetails[]
  contactsByCode: Record<string, ContactV1>
  selectable?: boolean
  selectedKeys?: string[]
  onKeySelectionChange?: (keyId: string, checked: boolean) => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
  onRefresh?: () => void
  onReturn?: (loan: KeyLoanWithDetails) => void
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
  contactsByCode,
  selectable = false,
  selectedKeys = [],
  onKeySelectionChange,
  onSelectAll,
  onDeselectAll,
  onRefresh,
  onReturn,
}: KeyBundleKeysListProps) {
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

  const columns = loanableItemColumns({
    checkboxWidth: 'w-[50px]',
    selectable,
    columns: [
      nameColumn({ width: 'w-[18%]', label: 'Nyckelnamn' }),
      seqColumn({ width: 'w-[6%]' }),
      flexColumn({ width: 'w-[6%]' }),
      systemColumn({ width: 'w-[10%]' }),
      {
        header: 'Tillhörighet',
        width: 'w-[12%]',
        key: (key) => key.keySystem?.name || '-',
        card: () => '-',
      },
      typeColumn({ width: 'w-[12%]' }),
      statusColumn,
      {
        header: 'Utlämning',
        width: 'w-[18%]',
        key: (key) => <PickupAvailabilityBadge itemData={key} />,
        card: (card) => <PickupAvailabilityBadge itemData={card} />,
      },
      {
        header: 'Hyresobjekt',
        width: 'w-[18%]',
        key: (key) => key.rentalObjectCode ?? '-',
        card: () => '-',
      },
    ],
  })

  return (
    <CollapsibleGroupTable
      items={keys}
      getItemId={(key) => key.id}
      columnCount={columns.columnCount}
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
      renderHeader={() =>
        columns.header({
          checked: isIndeterminate ? 'indeterminate' : allSelected,
          onCheckedChange: () =>
            allSelected ? onDeselectAll?.() : onSelectAll?.(),
        })
      }
      renderRow={(key, state) => columns.keyRow(key, state)}
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

        // Format the contact display inline from the sidecar map.
        // Format: "Name · Code · NationalRegistrationNumber". Falls back to
        // the raw code if the contact isn't in the map (e.g. contacts
        // service was down or the code isn't in the contacts DB).
        const contact = contactsByCode[contactCode]
        const contactDisplay = contact
          ? (() => {
              const parts = [getContactFullName(contact), contact.contactCode]
              const nrn = getContactRegistrationNumber(contact)
              if (nrn) parts.push(nrn)
              return parts.join(' · ')
            })()
          : contactCode

        return (
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-3">
              <span className="font-semibold">{contactDisplay}</span>
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
