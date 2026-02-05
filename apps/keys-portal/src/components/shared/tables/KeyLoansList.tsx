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
  contactData?: Record<
    string,
    {
      fullName: string
      contactCode: string
      nationalRegistrationNumber?: string
    }
  >
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('sv-SE')
}

function getContactFieldDisplay(
  loan: KeyLoan,
  contactData: NonNullable<KeyLoansListProps['contactData']>,
  field: 'fullName' | 'contactCode' | 'nationalRegistrationNumber'
) {
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

/** Simple table for displaying a list of key loans */
export function KeyLoansList({ loans, contactData = {} }: KeyLoansListProps) {
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
          <TableHead>Namn</TableHead>
          <TableHead>Kontaktkod</TableHead>
          <TableHead>Personnummer</TableHead>
          <TableHead>Kontaktperson</TableHead>
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
              {getContactFieldDisplay(loan, contactData, 'fullName')}
            </TableCell>
            <TableCell>
              {getContactFieldDisplay(loan, contactData, 'contactCode')}
            </TableCell>
            <TableCell>
              {getContactFieldDisplay(
                loan,
                contactData,
                'nationalRegistrationNumber'
              )}
            </TableCell>
            <TableCell>{loan.contactPerson ?? '-'}</TableCell>
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
