import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
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
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { LoanStatusBadge } from '@/components/shared/tables/StatusBadges'
import { LoanActionMenu } from '@/components/loan/LoanActionMenu'
import { LoanItemsTable } from '@/components/key-loans/LoanItemsTable'
import { ExpandedRowSubtable } from '@/components/shared/tables/ExpandedRowSubtable'
import { useExpandableRows } from '@/hooks/useExpandableRows'
import { fetchContactByContactCode } from '@/services/api/contactService'
import type { KeyLoanWithDetails } from '@/services/types'

const COLUMN_COUNT = 11

interface MaintenanceLoansTableProps {
  loans: KeyLoanWithDetails[]
  keySystemMap: Record<string, string>
  emptyMessage?: string
  onLoanReturned?: (loanId: string) => void
  onLoanUpdated?: (loanId: string) => void
}

/**
 * Table displaying maintenance key loans with expandable rows.
 * Composed from the same shared building blocks as KeyLoansExpandableTable,
 * with full contact info columns (Namn, Kontaktkod, Personnummer, Kontaktperson).
 */
export function MaintenanceLoansTable({
  loans,
  keySystemMap,
  emptyMessage = 'Inga lån',
  onLoanReturned,
  onLoanUpdated,
}: MaintenanceLoansTableProps) {
  const expansion = useExpandableRows()
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

  // Fetch contact names for all loans
  useEffect(() => {
    const fetchContactNames = async () => {
      const uniqueContactCodes = new Set<string>()

      loans.forEach((loan) => {
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

    if (loans.length > 0) {
      fetchContactNames()
    }
  }, [loans])

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    return format(new Date(date), 'd MMM yyyy', { locale: sv })
  }

  const getContactFieldDisplay = (
    loan: KeyLoanWithDetails,
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

  const renderContactCodeCell = (loan: KeyLoanWithDetails) => {
    const codes = [loan.contact, loan.contact2].filter(Boolean) as string[]
    if (codes.length === 0) return '-'

    const renderLink = (code: string) => {
      const displayCode = contactData[code]?.contactCode ?? code
      return (
        <TableLink key={code} to={`/maintenance-keys?contact=${displayCode}`}>
          {displayCode}
        </TableLink>
      )
    }

    if (codes.length === 1) return renderLink(codes[0])

    return <div className="flex flex-col gap-1">{codes.map(renderLink)}</div>
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <Table>
        <TableHeader className="bg-background">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[50px]" />
            <TableHead>Namn</TableHead>
            <TableHead>Kontaktkod</TableHead>
            <TableHead>Person/Orgnr</TableHead>
            <TableHead>Kontaktperson</TableHead>
            <TableHead className="w-[80px]">Objekt</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px]">Skapad</TableHead>
            <TableHead className="w-[100px]">Upphämtat</TableHead>
            <TableHead className="w-[100px]">Återlämnat</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.length === 0 ? (
            <TableEmptyState colSpan={COLUMN_COUNT} message={emptyMessage} />
          ) : (
            loans.map((loan) => {
              const isExpanded = expansion.isExpanded(loan.id)

              return (
                <React.Fragment key={loan.id}>
                  <TableRow className="h-12">
                    <TableCell className="w-[50px]">
                      <ExpandButton
                        isExpanded={isExpanded}
                        onClick={() => expansion.toggle(loan.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {getContactFieldDisplay(loan, 'fullName')}
                    </TableCell>
                    <TableCell>{renderContactCodeCell(loan)}</TableCell>
                    <TableCell>
                      {getContactFieldDisplay(
                        loan,
                        'nationalRegistrationNumber'
                      )}
                    </TableCell>
                    <TableCell>{loan.contactPerson ?? '-'}</TableCell>
                    <TableCellMuted>
                      {(loan.keysArray?.length || 0) +
                        (loan.keyCardsArray?.length || 0)}
                    </TableCellMuted>
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
                    <TableCell className="w-[50px]">
                      <LoanActionMenu
                        loan={loan}
                        onRefresh={() => onLoanUpdated?.(loan.id)}
                        onReturn={() => onLoanReturned?.(loan.id)}
                      />
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <ExpandedRowSubtable
                      colSpan={COLUMN_COUNT}
                      isLoading={false}
                      hasData={true}
                    >
                      <LoanItemsTable
                        loan={loan}
                        keySystemMap={keySystemMap}
                        columnCount={COLUMN_COUNT}
                        headerClassName="bg-muted/50 hover:bg-muted/70"
                      />
                    </ExpandedRowSubtable>
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
