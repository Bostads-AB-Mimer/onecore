import { useState, useEffect } from 'react'
import {
  TableCell,
  TableCellMuted,
  TableHead,
  TableRow,
  TableLink,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { KeyLoan, KeyLoanWithDetails } from '@/services/types'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { LoanItemsTable } from '@/components/loan/LoanItemsTable'
import { ReturnMaintenanceKeysDialog } from '@/components/maintenance/dialogs/ReturnMaintenanceKeysDialog'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { NumberRangeFilterDropdown } from '@/components/ui/number-range-filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'
import { DualNullableFilterDropdown } from '@/components/ui/dual-nullable-filter-dropdown'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { FilterableTableHeader } from '@/components/shared/tables/FilterableTableHeader'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import { LoanActionMenu } from '@/components/loan/LoanActionMenu'
import {
  LoanTypeBadge,
  LoanStatusBadge,
} from '@/components/shared/tables/StatusBadges'
import { ExpandableRowTable } from '@/components/shared/tables/ExpandableRowTable'

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

  const handleExpand = async (loanId: string): Promise<LoanExpandedData> => {
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
  }

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

      <ExpandableRowTable<KeyLoan, LoanExpandedData>
        items={keyLoans}
        getItemId={(loan) => loan.id}
        columnCount={COLUMN_COUNT}
        isLoadingItems={isLoading}
        emptyMessage="Inga nyckellån hittades"
        className="rounded-md border bg-card"
        onExpand={handleExpand}
        renderHeader={() => (
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
        )}
        renderRow={(
          loan,
          { isExpanded, isLoading: isLoadingRow, onToggle, loadedData }
        ) => {
          const isActive = !!loan.pickedUpAt && !loan.returnedAt

          return (
            <TableRow key={loan.id} className="hover:bg-muted/50">
              <TableCell>
                <ExpandButton
                  isExpanded={isExpanded}
                  isLoading={isLoadingRow}
                  onClick={onToggle}
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
                    const displayCode = contactData[code]?.contactCode ?? code
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
                {getContactFieldDisplay(loan, 'nationalRegistrationNumber')}
              </TableCell>
              <TableCell>{loan.contactPerson ?? '-'}</TableCell>
              <TableCell>
                <LoanTypeBadge loanType={loan.loanType} />
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {loadedData
                    ? (loadedData.loanDetails.keysArray?.length || 0) +
                      (loadedData.loanDetails.keyCardsArray?.length || 0)
                    : '-'}
                </Badge>
              </TableCell>
              <TableCell>
                <LoanStatusBadge loan={loan} />
              </TableCell>
              <TableCellMuted>{formatDate(loan.createdAt)}</TableCellMuted>
              <TableCellMuted>{formatDate(loan.pickedUpAt)}</TableCellMuted>
              <TableCellMuted>{formatDate(loan.returnedAt)}</TableCellMuted>
              <TableCell>
                {loadedData ? (
                  <LoanActionMenu
                    loan={loadedData.loanDetails}
                    onRefresh={onRefresh}
                    onReturn={() => setReturnLoan(loadedData.loanDetails)}
                  />
                ) : (
                  <ActionMenu
                    onEdit={() => onEdit?.(loan)}
                    onDelete={isActive ? undefined : () => onDelete?.(loan)}
                  />
                )}
              </TableCell>
            </TableRow>
          )
        }}
        renderExpandedContent={(_loan, { headerClassName, loadedData }) =>
          loadedData ? (
            <LoanItemsTable
              loan={loadedData.loanDetails}
              keySystemMap={loadedData.keySystemMap}
              columnCount={COLUMN_COUNT}
              headerClassName={headerClassName}
            />
          ) : null
        }
      />
    </>
  )
}
