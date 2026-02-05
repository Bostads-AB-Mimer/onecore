import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLink,
  TableEmptyState,
} from '@/components/ui/table'
import {
  Key,
  KeyLoan,
  KeyBundle,
  getKeyTypeFilterOptions,
} from '@/services/types'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'
import { SearchDropdown } from '@/components/ui/search-dropdown'
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
import { ExpandedRowContent } from '@/components/shared/tables/ExpandedRowContent'

interface KeyDetails {
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
  keys: Key[]
  keySystemMap: Record<string, string>
  onEdit: (key: Key) => void
  onDelete: (keyId: string) => void
  selectedType: string | null
  onTypeFilterChange: (value: string | null) => void
  selectedDisposed: string | null
  onDisposedFilterChange: (value: string | null) => void
  createdAtAfter: string | null
  createdAtBefore: string | null
  onDatesChange: (afterDate: string | null, beforeDate: string | null) => void
  keySystemSearch: string
  onKeySystemSearchChange: (query: string) => void
  selectedKeySystem: any | null
  onKeySystemSelect: (keySystem: any | null) => void
  onKeySystemSearch: (query: string) => Promise<any[]>
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
  keySystemSearch,
  onKeySystemSearchChange,
  selectedKeySystem,
  onKeySystemSelect,
  onKeySystemSearch,
}: KeysTableProps) {
  const expansion = useExpandableRows<KeyDetails>({
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

      const contactData: KeyDetails['contactData'] = {}
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

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Nyckelnamn</TableHead>
            <TableHead>Objekt</TableHead>
            <FilterableTableHeader label="Typ">
              <FilterDropdown
                options={getKeyTypeFilterOptions()}
                selectedValue={selectedType}
                onSelectionChange={onTypeFilterChange}
              />
            </FilterableTableHeader>
            <FilterableTableHeader label="">
              <SearchDropdown
                preSuggestions={[]}
                searchFn={onKeySystemSearch}
                minSearchLength={1}
                formatItem={(item: any) => ({
                  primaryText: item.systemCode,
                  secondaryText: item.name || undefined,
                  searchableText: `${item.systemCode} ${item.name || ''}`,
                })}
                getKey={(item: any) => item.id}
                value={keySystemSearch}
                onChange={onKeySystemSearchChange}
                onSelect={onKeySystemSelect}
                selectedValue={selectedKeySystem}
                placeholder="Låssystem"
                showSearchIcon
              />
            </FilterableTableHeader>
            <TableHead>Löpnummer</TableHead>
            <TableHead>Flexnr</TableHead>
            <FilterableTableHeader label="Kasserad">
              <FilterDropdown
                options={[
                  { label: 'Ja', value: 'true' },
                  { label: 'Nej', value: 'false' },
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
            <TableEmptyState colSpan={10} message="Inga nycklar hittades" />
          ) : (
            keys.map((key) => {
              const isExpanded = expansion.isExpanded(key.id)
              const isLoadingThis =
                expansion.isLoading && expansion.expandedId === key.id
              return (
                <React.Fragment key={key.id}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
                      <ExpandButton
                        isExpanded={isExpanded}
                        isLoading={isLoadingThis}
                        onClick={() => expansion.toggle(key.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{key.keyName}</TableCell>
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
                    <TableCell>{key.keySequenceNumber || '-'}</TableCell>
                    <TableCell>{key.flexNumber || '-'}</TableCell>
                    <TableCell>
                      <DisposedBadge
                        disposed={key.disposed ?? false}
                        showActive
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell>
                      <ActionMenu
                        onEdit={() => onEdit(key)}
                        onDelete={() => onDelete(key.id)}
                      />
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <ExpandedRowContent
                      colSpan={10}
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
                    </ExpandedRowContent>
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
