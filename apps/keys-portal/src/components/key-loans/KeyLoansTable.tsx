import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmptyState,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Undo2, User, FileText } from 'lucide-react'
import { KeyLoan, KeyLoanWithDetails, Key } from '@/services/types'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { KeysList } from '@/components/shared/tables/KeysList'
import { ReturnMaintenanceKeysDialog } from '@/components/maintenance/dialogs/ReturnMaintenanceKeysDialog'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { NumberRangeFilterDropdown } from '@/components/ui/number-range-filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'
import { DualNullableFilterDropdown } from '@/components/ui/dual-nullable-filter-dropdown'
import { useExpandableRows } from '@/hooks/useExpandableRows'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { FilterableTableHeader } from '@/components/shared/tables/FilterableTableHeader'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import {
  LoanTypeBadge,
  LoanStatusBadge,
} from '@/components/shared/tables/StatusBadges'
import { ExpandedRowContent } from '@/components/shared/tables/ExpandedRowContent'

interface KeyLoansTableProps {
  keyLoans: KeyLoan[]
  isLoading: boolean
  onRefresh?: () => void
  onEdit?: (loan: KeyLoan) => void
  onDelete?: (loan: KeyLoan) => void
  // Filter props
  loanTypeFilter: string | null
  onLoanTypeFilterChange: (value: string | null) => void
  minKeys: number | null
  maxKeys: number | null
  onKeyCountChange: (min: number | null, max: number | null) => void
  createdAtAfter: string | null
  createdAtBefore: string | null
  onCreatedAtDateChange: (
    afterDate: string | null,
    beforeDate: string | null
  ) => void
  pickedUpDateFilter: {
    hasValue: boolean | null
    after: string | null
    before: string | null
  }
  onPickedUpDateChange: (value: {
    hasValue: boolean | null
    after: string | null
    before: string | null
  }) => void
  returnedDateFilter: {
    hasValue: boolean | null
    after: string | null
    before: string | null
  }
  onReturnedDateChange: (value: {
    hasValue: boolean | null
    after: string | null
    before: string | null
  }) => void
}

export function KeyLoansTable({
  keyLoans,
  isLoading,
  onRefresh,
  onEdit,
  onDelete,
  loanTypeFilter,
  onLoanTypeFilterChange,
  minKeys,
  maxKeys,
  onKeyCountChange,
  createdAtAfter,
  createdAtBefore,
  onCreatedAtDateChange,
  pickedUpDateFilter,
  onPickedUpDateChange,
  returnedDateFilter,
  onReturnedDateChange,
}: KeyLoansTableProps) {
  const [contactNames, setContactNames] = useState<Record<string, string>>({})
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)

  interface LoanExpandedData {
    loanDetails: KeyLoanWithDetails
    keySystemMap: Record<string, string>
  }

  const expansion = useExpandableRows<LoanExpandedData>({
    onExpand: async (loanId) => {
      const loan = await keyLoanService.get(loanId)

      // Parse key IDs and fetch key details
      let keyIds: string[] = []
      try {
        keyIds = JSON.parse(loan.keys || '[]')
      } catch {
        keyIds = []
      }

      // Fetch all keys for this loan
      const keysArray: Key[] = []
      for (const keyId of keyIds) {
        try {
          const key = await keyService.getKey(keyId)
          keysArray.push(key)
        } catch (error) {
          console.error(`Failed to fetch key ${keyId}:`, error)
        }
      }

      // Create KeyLoanWithDetails object
      const loanDetails: KeyLoanWithDetails = {
        ...loan,
        keysArray,
        keyCardsArray: [],
        receipts: [],
      }

      // Build key system map for this loan's keys
      const uniqueKeySystemIds = [
        ...new Set(
          keysArray
            .map((k) => k.keySystemId)
            .filter((id): id is string => id != null && id !== '')
        ),
      ]

      const systemMap: Record<string, string> = {}
      if (uniqueKeySystemIds.length > 0) {
        await Promise.all(
          uniqueKeySystemIds.map(async (id) => {
            try {
              const keySystem = await keyService.getKeySystem(id)
              systemMap[id] = keySystem.systemCode
            } catch (error) {
              console.error(`Failed to fetch key system ${id}:`, error)
            }
          })
        )
      }

      // Update the component-level keySystemMap for MaintenanceKeysTable
      setKeySystemMap((prev) => ({ ...prev, ...systemMap }))

      return { loanDetails, keySystemMap: systemMap }
    },
  })

  // Fetch contact names for all loans
  useEffect(() => {
    const fetchContactNames = async () => {
      const uniqueContactCodes = new Set<string>()

      // Collect all unique contact codes
      keyLoans.forEach((loan) => {
        if (loan.contact) uniqueContactCodes.add(loan.contact)
        if (loan.contact2) uniqueContactCodes.add(loan.contact2)
      })

      // Fetch contact info for each contact code
      const names: Record<string, string> = {}
      await Promise.all(
        Array.from(uniqueContactCodes).map(async (contactCode) => {
          try {
            const contact = await fetchContactByContactCode(contactCode)
            if (contact) {
              // Format: Name · Code
              const parts = [contact.fullName, contactCode]
              if (contact.nationalRegistrationNumber) {
                parts.push(contact.nationalRegistrationNumber)
              }
              names[contactCode] = parts.join(' · ')
            }
          } catch (error) {
            console.error(`Failed to fetch contact ${contactCode}:`, error)
            names[contactCode] = contactCode
          }
        })
      )

      setContactNames(names)
    }

    if (keyLoans.length > 0) {
      fetchContactNames()
    }
  }, [keyLoans])

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('sv-SE')
  }

  const getKeyCount = (keysString: string) => {
    try {
      const keys = JSON.parse(keysString)
      return Array.isArray(keys) ? keys.length : 0
    } catch {
      return 0
    }
  }

  const getContactDisplay = (loan: KeyLoan) => {
    const contacts: string[] = []
    if (loan.contact && contactNames[loan.contact]) {
      contacts.push(contactNames[loan.contact])
    } else if (loan.contact) {
      contacts.push(loan.contact)
    }

    if (loan.contact2 && contactNames[loan.contact2]) {
      contacts.push(contactNames[loan.contact2])
    } else if (loan.contact2) {
      contacts.push(loan.contact2)
    }

    return contacts.length > 0 ? contacts.join(', ') : '-'
  }

  return (
    <>
      {/* Return dialog for maintenance loans */}
      {expansion.loadedData && expansion.expandedId && (
        <ReturnMaintenanceKeysDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          keyIds={expansion.loadedData.loanDetails.keysArray.map((k) => k.id)}
          allKeys={expansion.loadedData.loanDetails.keysArray}
          onSuccess={() => {
            setReturnDialogOpen(false)
            onRefresh?.()
          }}
        />
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Kontakt</TableHead>
              <FilterableTableHeader label="Lånetyp">
                <FilterDropdown
                  options={[
                    { label: 'Hyresgäst', value: 'TENANT' },
                    { label: 'Underhåll', value: 'MAINTENANCE' },
                  ]}
                  selectedValue={loanTypeFilter}
                  onSelectionChange={onLoanTypeFilterChange}
                />
              </FilterableTableHeader>
              <FilterableTableHeader label="Antal nycklar">
                <NumberRangeFilterDropdown
                  minValue={minKeys}
                  maxValue={maxKeys}
                  onRangeChange={onKeyCountChange}
                  minLabel="Minst antal nycklar"
                  maxLabel="Max antal nycklar"
                />
              </FilterableTableHeader>
              <FilterableTableHeader label="Status">
                <DualNullableFilterDropdown
                  label1="Upphämtat"
                  label2="Återlämnat"
                  value1={{ hasValue: pickedUpDateFilter.hasValue }}
                  value2={{ hasValue: returnedDateFilter.hasValue }}
                  onChange1={(value) =>
                    onPickedUpDateChange({
                      hasValue: value.hasValue,
                      after: null,
                      before: null,
                    })
                  }
                  onChange2={(value) =>
                    onReturnedDateChange({
                      hasValue: value.hasValue,
                      after: null,
                      before: null,
                    })
                  }
                />
              </FilterableTableHeader>
              <FilterableTableHeader label="Skapad">
                <DateRangeFilterDropdown
                  afterDate={createdAtAfter}
                  beforeDate={createdAtBefore}
                  onDatesChange={onCreatedAtDateChange}
                />
              </FilterableTableHeader>
              <FilterableTableHeader label="Upphämtat">
                <DateRangeFilterDropdown
                  afterDate={pickedUpDateFilter.after}
                  beforeDate={pickedUpDateFilter.before}
                  onDatesChange={(after, before) =>
                    onPickedUpDateChange({
                      hasValue: pickedUpDateFilter.hasValue,
                      after,
                      before,
                    })
                  }
                />
              </FilterableTableHeader>
              <FilterableTableHeader label="Återlämnat">
                <DateRangeFilterDropdown
                  afterDate={returnedDateFilter.after}
                  beforeDate={returnedDateFilter.before}
                  onDatesChange={(after, before) =>
                    onReturnedDateChange({
                      hasValue: returnedDateFilter.hasValue,
                      after,
                      before,
                    })
                  }
                />
              </FilterableTableHeader>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || keyLoans.length === 0 ? (
              <TableEmptyState
                colSpan={9}
                isLoading={isLoading}
                message="Inga nyckellån hittades"
              />
            ) : (
              keyLoans.map((loan) => {
                const isExpanded = expansion.isExpanded(loan.id)
                const isLoadingThis = expansion.isLoading && expansion.expandedId === loan.id
                const keyCount = getKeyCount(loan.keys)
                const isPickedUp = !!loan.pickedUpAt
                const isReturned = !!loan.returnedAt
                const isActive = isPickedUp && !isReturned

                return (
                  <React.Fragment key={loan.id}>
                    {/* Main loan row */}
                    <TableRow className="hover:bg-muted/50">
                      <TableCell>
                        <ExpandButton
                          isExpanded={isExpanded}
                          isLoading={isLoadingThis}
                          onClick={() => expansion.toggle(loan.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {getContactDisplay(loan)}
                      </TableCell>
                      <TableCell>
                        <LoanTypeBadge loanType={loan.loanType} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{keyCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <LoanStatusBadge loan={loan} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(loan.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(loan.pickedUpAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(loan.returnedAt)}
                      </TableCell>
                      <TableCell>
                        <ActionMenu
                          onEdit={() => onEdit?.(loan)}
                          onDelete={isActive ? undefined : () => onDelete?.(loan)}
                        />
                      </TableCell>
                    </TableRow>

                    {/* Expanded keys section */}
                    {isExpanded && (
                      <ExpandedRowContent
                        colSpan={9}
                        isLoading={expansion.isLoading}
                        hasData={!!expansion.loadedData}
                        emptyMessage="Inga nycklar i detta lån"
                        className="p-0"
                      >
                        <div className="space-y-4">
                          {/* Contact info and Action buttons */}
                          <div className="flex items-start justify-between gap-4">
                            {/* Left: Contact Person and Description */}
                            <div className="flex-1 space-y-1.5">
                              {expansion.loadedData?.loanDetails.contactPerson && (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {expansion.loadedData.loanDetails.contactPerson}
                                  </span>
                                </div>
                              )}
                              {expansion.loadedData?.loanDetails.description && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <FileText className="h-4 w-4" />
                                  <span>{expansion.loadedData.loanDetails.description}</span>
                                </div>
                              )}
                            </div>

                            {/* Right: Action buttons */}
                            <div className="flex items-center gap-2">
                              {/* Return button - only show for active loans */}
                              {isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReturnDialogOpen(true)}
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Återlämna
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Keys table */}
                          <KeysList
                            keys={expansion.loadedData?.loanDetails.keysArray || []}
                            keySystemMap={keySystemMap}
                          />
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
    </>
  )
}
