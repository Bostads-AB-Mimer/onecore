import React from 'react'
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
} from '@/components/ui/table'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import {
  LoanTypeBadge,
  LoanStatusBadge,
  EarlyHandoutBadge,
} from '@/components/shared/tables/StatusBadges'
import { LoanActionMenu } from './LoanActionMenu'
import { LoanItemsTable } from './LoanItemsTable'
import { ExpandedRowSubtable } from '@/components/shared/tables/ExpandedRowSubtable'
import { useExpandableRows } from '@/hooks/useExpandableRows'
import type { KeyLoanWithDetails, Lease, CardDetails } from '@/services/types'

const COLUMN_COUNT = 9

interface KeyLoansExpandableTableProps {
  loans: KeyLoanWithDetails[]
  keySystemMap: Record<string, string>
  cardDetailsMap?: Record<string, CardDetails>
  lease?: Lease
  emptyMessage?: string
  onLoanReturned?: (loanId: string) => void
  onLoanUpdated?: (loanId: string) => void
}

/**
 * Table displaying key loans with expandable rows for viewing keys/cards.
 * Uses useExpandableRows hook + ExpandedRowSubtable for expand/collapse behavior.
 */
export function KeyLoansExpandableTable({
  loans,
  keySystemMap,
  cardDetailsMap = {},
  lease,
  emptyMessage = 'Inga lån',
  onLoanReturned,
  onLoanUpdated,
}: KeyLoansExpandableTableProps) {
  const expansion = useExpandableRows()

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    return format(new Date(date), 'd MMM yyyy', { locale: sv })
  }

  const handleReturn = (loanId: string) => {
    onLoanReturned?.(loanId)
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <Table>
        <TableHeader className="bg-background">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[50px]" />
            <TableHead className="w-[100px]">Typ</TableHead>
            <TableHead className="w-[80px]">Objekt</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px]">Skapad</TableHead>
            <TableHead className="w-[100px]">Upphämtat</TableHead>
            <TableHead className="w-[100px]">Återlämnat</TableHead>
            <TableHead className="w-[150px]">Tidig utlämning</TableHead>
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
                    <TableCell>
                      <LoanTypeBadge loanType={loan.loanType} />
                    </TableCell>
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
                    <TableCell>
                      <EarlyHandoutBadge loan={loan} />
                    </TableCell>
                    <TableCell className="w-[50px]">
                      <LoanActionMenu
                        loan={loan}
                        lease={lease}
                        onRefresh={() => onLoanUpdated?.(loan.id)}
                        onReturn={() => handleReturn(loan.id)}
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
                        cardDetailsMap={cardDetailsMap}
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
