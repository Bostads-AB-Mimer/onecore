import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  TableCell,
  TableCellMuted,
  TableHead,
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
import { ExpandableRowTable } from '@/components/shared/tables/ExpandableRowTable'
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
 * Uses ExpandableRowTable for the expand/collapse behavior with proper hover on subtable rows.
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
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    return format(new Date(date), 'd MMM yyyy', { locale: sv })
  }

  const handleReturn = (loanId: string) => {
    onLoanReturned?.(loanId)
  }

  return (
    <ExpandableRowTable
      items={loans}
      getItemId={(loan) => loan.id}
      columnCount={COLUMN_COUNT}
      emptyMessage={emptyMessage}
      renderHeader={() => (
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[50px]" /> {/* Expand button */}
          <TableHead className="w-[100px]">Typ</TableHead>
          <TableHead className="w-[80px]">Objekt</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[100px]">Skapad</TableHead>
          <TableHead className="w-[100px]">Upphämtat</TableHead>
          <TableHead className="w-[100px]">Återlämnat</TableHead>
          <TableHead className="w-[150px]">Tidig utlämning</TableHead>
          <TableHead className="w-[50px]" /> {/* Actions */}
        </TableRow>
      )}
      renderRow={(loan, { isExpanded, onToggle }) => (
        <TableRow key={loan.id} className="h-12">
          <TableCell className="w-[50px]">
            <ExpandButton isExpanded={isExpanded} onClick={onToggle} />
          </TableCell>
          <TableCell>
            <LoanTypeBadge loanType={loan.loanType} />
          </TableCell>
          <TableCellMuted>
            {(loan.keysArray?.length || 0) + (loan.keyCardsArray?.length || 0)}
          </TableCellMuted>
          <TableCell>
            <LoanStatusBadge loan={loan} />
          </TableCell>
          <TableCellMuted>{formatDate(loan.createdAt)}</TableCellMuted>
          <TableCellMuted>{formatDate(loan.pickedUpAt)}</TableCellMuted>
          <TableCellMuted>{formatDate(loan.returnedAt)}</TableCellMuted>
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
      )}
      renderExpandedContent={(loan, { headerClassName }) => (
        <LoanItemsTable
          loan={loan}
          keySystemMap={keySystemMap}
          cardDetailsMap={cardDetailsMap}
          columnCount={COLUMN_COUNT}
          headerClassName={headerClassName}
        />
      )}
    />
  )
}
