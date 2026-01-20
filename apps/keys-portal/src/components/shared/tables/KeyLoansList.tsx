import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { KeyLoan } from '@/services/types'
import { LoanTypeBadge, LoanStatusBadge } from './StatusBadges'

interface KeyLoansListProps {
  loans: KeyLoan[]
  contactNames?: Record<string, string>
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('sv-SE')
}

function getContactDisplay(
  loan: KeyLoan,
  contactNames: Record<string, string>
) {
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

/** Simple table for displaying a list of key loans */
export function KeyLoansList({ loans, contactNames = {} }: KeyLoansListProps) {
  if (loans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Inga nyckellån
      </div>
    )
  }

  return (
    <Table>
      <TableHeader className="border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead>Kontakt</TableHead>
          <TableHead>Lånetyp</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Skapad</TableHead>
          <TableHead>Upphämtat</TableHead>
          <TableHead>Återlämnat</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan) => (
          <TableRow key={loan.id} className="h-12 hover:bg-muted/50">
            <TableCell className="font-medium">
              {getContactDisplay(loan, contactNames)}
            </TableCell>
            <TableCell>
              <LoanTypeBadge loanType={loan.loanType} />
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
