import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Undo2,
  User,
  FileText,
} from 'lucide-react'
import { KeyLoan, KeyLoanWithDetails, Key } from '@/services/types'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { MaintenanceKeysTable } from '@/components/maintenance/MaintenanceKeysTable'
import { MaintenanceReceiptActions } from '@/components/maintenance/MaintenanceReceiptActions'
import { ReturnMaintenanceKeysDialog } from '@/components/maintenance/dialogs/ReturnMaintenanceKeysDialog'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { NullableDateFilterDropdown } from '@/components/ui/nullable-date-filter-dropdown'
import { NumberRangeFilterDropdown } from '@/components/ui/number-range-filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'

interface KeyLoansTableProps {
  keyLoans: KeyLoan[]
  isLoading: boolean
  onRefresh?: () => void
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

const LoanTypeLabels = {
  TENANT: 'Hyresgäst',
  MAINTENANCE: 'Underhåll',
}

export function KeyLoansTable({
  keyLoans,
  isLoading,
  onRefresh,
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
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null)
  const [loanDetails, setLoanDetails] = useState<KeyLoanWithDetails | null>(
    null
  )
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [contactNames, setContactNames] = useState<Record<string, string>>({})
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)

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

  const handleToggleExpand = async (loanId: string) => {
    if (expandedLoanId === loanId) {
      // Collapse if already expanded
      setExpandedLoanId(null)
      setLoanDetails(null)
    } else {
      // Expand and load loan details with keys
      setExpandedLoanId(loanId)
      setIsLoadingDetails(true)
      try {
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
        const loanWithDetails: KeyLoanWithDetails = {
          ...loan,
          keysArray,
          receipts: [],
        }

        setLoanDetails(loanWithDetails)

        // Build key system map for this loan's keys
        const uniqueKeySystemIds = [
          ...new Set(
            keysArray
              .map((k) => k.keySystemId)
              .filter((id): id is string => id != null && id !== '')
          ),
        ]

        if (uniqueKeySystemIds.length > 0) {
          const systemMap: Record<string, string> = {}
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
          setKeySystemMap(systemMap)
        }
      } catch (error) {
        console.error('Failed to load loan details:', error)
        setLoanDetails(null)
      } finally {
        setIsLoadingDetails(false)
      }
    }
  }

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (keyLoans.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Inga nyckellån hittades
      </div>
    )
  }

  return (
    <>
      {/* Return dialog for maintenance loans */}
      {loanDetails && expandedLoanId && (
        <ReturnMaintenanceKeysDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          keyIds={loanDetails.keysArray.map((k) => k.id)}
          allKeys={loanDetails.keysArray}
          onSuccess={() => {
            setReturnDialogOpen(false)
            onRefresh?.()
          }}
        />
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead className="font-medium">
                <div className="flex items-center gap-1">
                  Lånetyp
                  <FilterDropdown
                    options={[
                      { label: 'Hyresgäst', value: 'TENANT' },
                      { label: 'Underhåll', value: 'MAINTENANCE' },
                    ]}
                    selectedValue={loanTypeFilter}
                    onSelectionChange={onLoanTypeFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="font-medium">
                <div className="flex items-center gap-1">
                  Antal nycklar
                  <NumberRangeFilterDropdown
                    minValue={minKeys}
                    maxValue={maxKeys}
                    onRangeChange={onKeyCountChange}
                    minLabel="Minst antal nycklar"
                    maxLabel="Max antal nycklar"
                  />
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="font-medium">
                <div className="flex items-center gap-1">
                  Skapad
                  <DateRangeFilterDropdown
                    afterDate={createdAtAfter}
                    beforeDate={createdAtBefore}
                    onDatesChange={onCreatedAtDateChange}
                  />
                </div>
              </TableHead>
              <TableHead className="font-medium">
                <div className="flex items-center gap-1">
                  Upphämtat
                  <NullableDateFilterDropdown
                    label="Upphämtat"
                    value={pickedUpDateFilter}
                    onChange={onPickedUpDateChange}
                  />
                </div>
              </TableHead>
              <TableHead className="font-medium">
                <div className="flex items-center gap-1">
                  Återlämnat
                  <NullableDateFilterDropdown
                    label="Återlämnat"
                    value={returnedDateFilter}
                    onChange={onReturnedDateChange}
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keyLoans.map((loan) => {
              const isExpanded = expandedLoanId === loan.id
              const keyCount = getKeyCount(loan.keys)
              const isPickedUp = !!loan.pickedUpAt
              const isReturned = !!loan.returnedAt
              const isActive = isPickedUp && !isReturned

              // Determine status
              let statusBadge
              if (isReturned) {
                statusBadge = <Badge variant="secondary">Återlämnad</Badge>
              } else if (isPickedUp) {
                statusBadge = (
                  <Badge variant="default" className="bg-green-600">
                    Aktiv
                  </Badge>
                )
              } else {
                statusBadge = (
                  <Badge variant="outline" className="text-muted-foreground">
                    Ej upphämtad
                  </Badge>
                )
              }

              return (
                <React.Fragment key={loan.id}>
                  {/* Main loan row */}
                  <TableRow>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleExpand(loan.id)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getContactDisplay(loan)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {LoanTypeLabels[loan.loanType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{keyCount}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge}</TableCell>
                    <TableCell>{formatDate(loan.createdAt)}</TableCell>
                    <TableCell>{formatDate(loan.pickedUpAt)}</TableCell>
                    <TableCell>{formatDate(loan.returnedAt)}</TableCell>
                  </TableRow>

                  {/* Expanded keys section */}
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={8} className="p-6 bg-muted/30">
                        {isLoadingDetails ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : !loanDetails ? (
                          <div className="text-center text-muted-foreground py-8">
                            Inga nycklar i detta lån
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Contact info and Action buttons */}
                            <div className="flex items-start justify-between gap-4">
                              {/* Left: Contact Person and Description */}
                              <div className="flex-1 space-y-1.5">
                                {loanDetails.contactPerson && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {loanDetails.contactPerson}
                                    </span>
                                  </div>
                                )}
                                {loanDetails.description && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    <span>{loanDetails.description}</span>
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

                                {/* Receipt actions */}
                                <MaintenanceReceiptActions
                                  loanId={loan.id}
                                  onRefresh={onRefresh}
                                />
                              </div>
                            </div>

                            {/* Keys table */}
                            <MaintenanceKeysTable
                              keys={loanDetails.keysArray}
                              keySystemMap={keySystemMap}
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
