import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableCellMuted,
  TableHead,
  TableHeader,
  TableRow,
  TableLink,
  TableEmptyState,
} from '@/components/ui/table'
import {
  KeyDetails,
  KeyLoan,
  KeyBundle,
  getKeyTypeFilterOptions,
} from '@/services/types'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'
import { Checkbox } from '@/components/ui/checkbox'
import type { UseItemSelectionReturn } from '@/hooks/useItemSelection'
import { keyLoanService } from '@/services/api/keyLoanService'
import { getKeyBundlesByKeyId } from '@/services/api/keyBundleService'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { useExpandableRows } from '@/hooks/useExpandableRows'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { FilterableTableHeader } from '@/components/shared/tables/FilterableTableHeader'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import {
  KeyTypeBadge,
  DisposedBadge,
} from '@/components/shared/tables/StatusBadges'
import { KeyLoansList } from '@/components/shared/tables/KeyLoansList'
import { KeyBundlesList } from '@/components/shared/tables/KeyBundlesList'
import { ExpandedRowFreeContent } from '@/components/shared/tables/ExpandedRowFreeContent'

interface ExpandedKeyData {
  loans: KeyLoan[]
  bundles: KeyBundle[]
  contactData: Record<
    string,
    {
      fullName: string
      contactCode: string
      nationalRegistrationNumber?: string
    }
  >
}

interface KeysTableProps {
  keys: KeyDetails[]
  keySystemMap: Record<string, string>
  onEdit: (key: KeyDetails) => void
  onDelete: (keyId: string) => void
  selectedType: string | null
  onTypeFilterChange: (value: string | null) => void
  selectedDisposed: string | null
  onDisposedFilterChange: (value: string | null) => void
  createdAtAfter: string | null
  createdAtBefore: string | null
  onDatesChange: (afterDate: string | null, beforeDate: string | null) => void
  selection?: UseItemSelectionReturn
}

export function KeysTable({
  keys,
  keySystemMap,
  onEdit,
  onDelete,
  selectedType,
  onTypeFilterChange,
  selectedDisposed,
  onDisposedFilterChange,
  createdAtAfter,
  createdAtBefore,
  onDatesChange,
  selection,
}: KeysTableProps) {
  const expansion = useExpandableRows<ExpandedKeyData>({
    onExpand: async (keyId) => {
      const [loans, bundles] = await Promise.all([
        keyLoanService.getByKeyId(keyId),
        getKeyBundlesByKeyId(keyId),
      ])

      const sortedLoans = loans.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      const sortedBundles = bundles.sort((a, b) => a.name.localeCompare(b.name))

      const uniqueContactCodes = new Set<string>()
      loans.forEach((loan) => {
        if (loan.contact) uniqueContactCodes.add(loan.contact)
        if (loan.contact2) uniqueContactCodes.add(loan.contact2)
      })

      const contactData: ExpandedKeyData['contactData'] = {}
      await Promise.all(
        Array.from(uniqueContactCodes).map(async (contactCode) => {
          try {
            const contact = await fetchContactByContactCode(contactCode)
            if (contact) {
              contactData[contactCode] = {
                fullName: contact.fullName ?? contactCode,
                contactCode,
                nationalRegistrationNumber:
                  contact.nationalRegistrationNumber || undefined,
              }
            }
          } catch (error) {
            console.error(`Failed to fetch contact ${contactCode}:`, error)
            contactData[contactCode] = { fullName: contactCode, contactCode }
          }
        })
      )

      return { loans: sortedLoans, bundles: sortedBundles, contactData }
    },
  })

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  // Column count for expanded rows (base 11 + 1 if selection enabled)
  const columnCount = selection ? 12 : 11

  const itemIds = keys.map((key) => key.id)
  const allSelected = selection?.areAllSelected(itemIds) ?? false
  const isIndeterminate = selection?.areSomeSelected(itemIds) ?? false

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            {selection && (
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isIndeterminate ? 'indeterminate' : allSelected}
                  onCheckedChange={() => selection.toggleAll(itemIds)}
                />
              </TableHead>
            )}
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Nyckelnamn</TableHead>
            <TableHead>Löpnr</TableHead>
            <TableHead>Flexnr</TableHead>
            <TableHead>Låssystem</TableHead>
            <TableHead>Tillhörighet</TableHead>
            <TableHead>Objekt</TableHead>
            <FilterableTableHeader label="Typ">
              <FilterDropdown
                options={getKeyTypeFilterOptions()}
                selectedValue={selectedType}
                onSelectionChange={onTypeFilterChange}
              />
            </FilterableTableHeader>
            <FilterableTableHeader label="Status">
              <FilterDropdown
                options={[
                  { label: 'Kasserad', value: 'true' },
                  { label: 'Aktiv', value: 'false' },
                ]}
                selectedValue={selectedDisposed}
                onSelectionChange={onDisposedFilterChange}
              />
            </FilterableTableHeader>
            <FilterableTableHeader label="Skapad">
              <DateRangeFilterDropdown
                afterDate={createdAtAfter}
                beforeDate={createdAtBefore}
                onDatesChange={onDatesChange}
              />
            </FilterableTableHeader>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 ? (
            <TableEmptyState
              colSpan={columnCount}
              message="Inga nycklar hittades"
            />
          ) : (
            keys.map((key) => {
              const isExpanded = expansion.isExpanded(key.id)
              const isLoadingThis =
                expansion.isLoading && expansion.expandedId === key.id
              const isSelected = selection?.isSelected(key.id) ?? false
              return (
                <React.Fragment key={key.id}>
                  <TableRow
                    className="hover:bg-muted/50"
                    data-state={isSelected ? 'selected' : undefined}
                  >
                    {selection && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => selection.toggle(key.id)}
                          aria-label={`Markera ${key.keyName}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <ExpandButton
                        isExpanded={isExpanded}
                        isLoading={isLoadingThis}
                        onClick={() => expansion.toggle(key.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{key.keyName}</TableCell>
                    <TableCell>{key.keySequenceNumber || '-'}</TableCell>
                    <TableCell>{key.flexNumber || '-'}</TableCell>
                    <TableCell>
                      {key.keySystemId && keySystemMap[key.keySystemId] ? (
                        <TableLink
                          to={`/key-systems?q=${keySystemMap[key.keySystemId]}&editKeySystemId=${key.keySystemId}`}
                        >
                          {keySystemMap[key.keySystemId]}
                        </TableLink>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCellMuted>
                      {key.keySystem?.name || '-'}
                    </TableCellMuted>
                    <TableCell>
                      {key.rentalObjectCode ? (
                        <TableLink
                          to={`/KeyLoan?object=${key.rentalObjectCode}`}
                        >
                          {key.rentalObjectCode}
                        </TableLink>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <KeyTypeBadge
                        keyType={key.keyType}
                        withVariant
                        className="text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <DisposedBadge
                        disposed={key.disposed ?? false}
                        showActive
                      />
                    </TableCell>
                    <TableCellMuted>{formatDate(key.createdAt)}</TableCellMuted>
                    <TableCell>
                      <ActionMenu
                        onEdit={() => onEdit(key)}
                        onDelete={() => onDelete(key.id)}
                        deleteDisabled={
                          key.keyType === 'HN' || key.keyType === 'FS'
                        }
                        deleteDisabledReason="Huvudnycklar och fastighetsnycklar kan inte tas bort"
                      />
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <ExpandedRowFreeContent
                      colSpan={columnCount}
                      isLoading={expansion.isLoading}
                      hasData={!!expansion.loadedData}
                      emptyMessage="Kunde inte ladda detaljer för denna nyckel"
                    >
                      <div className="space-y-6">
                        {expansion.loadedData?.loans.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">
                              Nyckellån
                            </h3>
                            <div className="rounded-lg border bg-card overflow-hidden">
                              <KeyLoansList
                                loans={expansion.loadedData.loans}
                                contactData={expansion.loadedData.contactData}
                              />
                            </div>
                          </div>
                        )}

                        {expansion.loadedData?.bundles.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3">
                              Nyckelsamlingar
                            </h3>
                            <div className="rounded-lg border bg-card overflow-hidden">
                              <KeyBundlesList
                                bundles={expansion.loadedData.bundles}
                              />
                            </div>
                          </div>
                        )}

                        {expansion.loadedData?.loans.length === 0 &&
                          expansion.loadedData?.bundles.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                              Denna nyckel ingår inte i några lån eller
                              samlingar
                            </div>
                          )}
                      </div>
                    </ExpandedRowFreeContent>
                  )}
                </React.Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
