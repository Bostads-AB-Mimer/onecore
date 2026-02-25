import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableCellMuted,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
  TableLink,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { KeyLoan, KeyLoanWithDetails } from '@/services/types'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { LoanItemsTable } from '@/components/key-loans/LoanItemsTable'
import { ReturnMaintenanceKeysDialog } from '@/components/maintenance/dialogs/ReturnMaintenanceKeysDialog'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { NumberRangeFilterDropdown } from '@/components/ui/number-range-filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'
import { DualNullableFilterDropdown } from '@/components/ui/dual-nullable-filter-dropdown'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { FilterableTableHeader } from '@/components/shared/tables/FilterableTableHeader'
import { NotePopover } from '@/components/shared/tables/NotePopover'
import { LoanActionMenu } from '@/components/loan/LoanActionMenu'
import {
  LoanTypeBadge,
  LoanStatusBadge,
} from '@/components/shared/tables/StatusBadges'
import { ExpandedRowSubtable } from '@/components/shared/tables/ExpandedRowSubtable'
import { useExpandableRows } from '@/hooks/useExpandableRows'

const COLUMN_COUNT = 12

interface LoanExpandedData {
  loanDetails: KeyLoanWithDetails
  keySystemMap: Record<string, string>
}

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
  const [contactData, setContactData] = useState<
    Record<
      string,
      {
        fullName: string
        contactCode: string
        nationalRegistrationNumber?: string
      }
    >
  >({})
  const [returnLoan, setReturnLoan] = useState<KeyLoanWithDetails | null>(null)

  const expansion = useExpandableRows<LoanExpandedData>({
    onExpand: async (loanId) => {
      const loanDetails = (await keyLoanService.get(loanId, {
        includeKeySystem: true,
        includeCards: true,
      })) as KeyLoanWithDetails

      const keysArray = loanDetails.keysArray || []
      const systemMap: Record<string, string> = {}
      keysArray.forEach((key) => {
        if (key.keySystemId && key.keySystem?.systemCode) {
          systemMap[key.keySystemId] = key.keySystem.systemCode
        }
      })

      return { loanDetails, keySystemMap: systemMap }
    },
  })

  // Fetch contact names for all loans
  useEffect(() => {
    const fetchContactNames = async () => {
      const uniqueContactCodes = new Set<string>()

      keyLoans.forEach((loan) => {
        if (loan.contact) uniqueContactCodes.add(loan.contact)
        if (loan.contact2) uniqueContactCodes.add(loan.contact2)
      })

      const data: typeof contactData = {}
      await Promise.all(
        Array.from(uniqueContactCodes).map(async (contactCode) => {
          try {
            const contact = await fetchContactByContactCode(contactCode)
            if (contact) {
              data[contactCode] = {
                fullName: contact.fullName ?? contactCode,
                contactCode,
                nationalRegistrationNumber:
                  contact.nationalRegistrationNumber || undefined,
              }
            }
          } catch (error) {
            console.error(`Failed to fetch contact ${contactCode}:`, error)
            data[contactCode] = { fullName: contactCode, contactCode }
          }
        })
      )

      setContactData(data)
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

  const getContactFieldDisplay = (
    loan: KeyLoan,
    field: 'fullName' | 'contactCode' | 'nationalRegistrationNumber'
  ) => {
    const codes = [loan.contact, loan.contact2].filter(Boolean) as string[]
    if (codes.length === 0) return '-'

    const values = codes.map((code) => {
      const data = contactData[code]
      if (!data) return field === 'contactCode' ? code : '-'
      return data[field] ?? '-'
    })

    if (values.length === 1) return values[0]

    return (
      <div className="flex flex-col gap-1">
        {values.map((value, index) => (
          <span key={index}>{value}</span>
        ))}
      </div>
    )
  }

  return (
    <>
      {returnLoan && (
        <ReturnMaintenanceKeysDialog
          open={!!returnLoan}
          onOpenChange={(open) => {
            if (!open) setReturnLoan(null)
          }}
          keyIds={returnLoan.keysArray.map((k) => k.id)}
          allKeys={returnLoan.keysArray}
          onSuccess={() => {
            setReturnLoan(null)
            onRefresh?.()
          }}
        />
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-background">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-[50px]" />
              <TableHead>Namn</TableHead>
              <TableHead>Kontaktkod</TableHead>
              <TableHead>Personnummer</TableHead>
              <TableHead>Kontaktperson</TableHead>
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
              <FilterableTableHeader label="Nycklar" className="w-[80px]">
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
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || keyLoans.length === 0 ? (
              <TableEmptyState
                colSpan={COLUMN_COUNT}
                message="Inga nyckellån hittades"
                isLoading={isLoading}
              />
            ) : (
              keyLoans.map((loan) => {
                const isExpanded = expansion.isExpanded(loan.id)
                const isLoadingThis =
                  isExpanded &&
                  expansion.isLoading &&
                  expansion.expandedId === loan.id
                return (
                  <React.Fragment key={loan.id}>
                    <TableRow className="hover:bg-muted/50">
                      <TableCell>
                        <ExpandButton
                          isExpanded={isExpanded}
                          isLoading={isLoadingThis}
                          onClick={() => expansion.toggle(loan.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {getContactFieldDisplay(loan, 'fullName')}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const codes = [loan.contact, loan.contact2].filter(
                            Boolean
                          ) as string[]
                          if (codes.length === 0) return '-'

                          const renderLink = (code: string) => {
                            const displayCode =
                              contactData[code]?.contactCode ?? code
                            const to =
                              loan.loanType === 'MAINTENANCE'
                                ? `/maintenance-keys?contact=${displayCode}`
                                : `/KeyLoan?tenant=${displayCode}`
                            return (
                              <TableLink key={code} to={to}>
                                {displayCode}
                              </TableLink>
                            )
                          }

                          if (codes.length === 1) return renderLink(codes[0])

                          return (
                            <div className="flex flex-col gap-1">
                              {codes.map(renderLink)}
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {getContactFieldDisplay(
                          loan,
                          'nationalRegistrationNumber'
                        )}
                      </TableCell>
                      <TableCell>{loan.contactPerson ?? '-'}</TableCell>
                      <TableCell>
                        <LoanTypeBadge loanType={loan.loanType} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {isExpanded && !isLoadingThis && expansion.loadedData
                            ? (expansion.loadedData.loanDetails.keysArray
                                ?.length || 0) +
                              (expansion.loadedData.loanDetails.keyCardsArray
                                ?.length || 0)
                            : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <LoanStatusBadge loan={loan} />
                      </TableCell>
                      <TableCellMuted>
                        {formatDate(loan.createdAt)}
                      </TableCellMuted>
                      <TableCellMuted>
                        {formatDate(loan.pickedUpAt)}
                      </TableCellMuted>
                      <TableCellMuted>
                        {formatDate(loan.returnedAt)}
                      </TableCellMuted>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <NotePopover text={loan.notes} />
                          <LoanActionMenu
                            loan={
                              isExpanded && expansion.loadedData
                                ? expansion.loadedData.loanDetails
                                : loan
                            }
                            onRefresh={onRefresh}
                            onEdit={
                              onEdit
                                ? (enrichedLoan) => onEdit(enrichedLoan)
                                : undefined
                            }
                            onReturn={(enrichedLoan) => {
                              setReturnLoan(enrichedLoan)
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <ExpandedRowSubtable
                        colSpan={COLUMN_COUNT}
                        isLoading={isLoadingThis}
                        hasData={!!expansion.loadedData}
                      >
                        {expansion.loadedData && (
                          <LoanItemsTable
                            loan={expansion.loadedData.loanDetails}
                            keySystemMap={expansion.loadedData.keySystemMap}
                            columnCount={COLUMN_COUNT}
                            headerClassName="bg-muted/50 hover:bg-muted/70"
                          />
                        )}
                      </ExpandedRowSubtable>
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
