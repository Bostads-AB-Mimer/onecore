import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { KeyLoan } from '@/services/types'

export interface DefaultLoanHeaderProps {
  loan: KeyLoan
  companyNames?: Record<string, string>
  leaseContactCodes?: string[]
}

/** Loan header for collapsible sections - shows loan type, contact, and dates */
export function DefaultLoanHeader({
  loan,
  companyNames = {},
  leaseContactCodes,
}: DefaultLoanHeaderProps) {
  const contactParts = [loan.contact, loan.contact2]
    .filter(Boolean)
    .map((c) => companyNames[c!] || c!)
  const contactDisplay =
    contactParts.length > 0 ? contactParts.join(' & ') : null

  const loanContacts = [loan.contact, loan.contact2].filter(Boolean)
  const isCurrentTenant =
    leaseContactCodes &&
    loanContacts.length > 0 &&
    loanContacts.some((c) => leaseContactCodes.includes(c!))

  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline">
        {loan.loanType === 'TENANT' ? 'Hyresgästlån' : 'Underhållslån'}
      </Badge>

      {contactDisplay && (
        <span className="text-muted-foreground">Kontakt: {contactDisplay}</span>
      )}

      {leaseContactCodes &&
        loan.contact &&
        (isCurrentTenant ? (
          <Badge variant="default" className="bg-green-600 text-[11px] py-0">
            Denna hyresgäst
          </Badge>
        ) : (
          <Badge
            variant={loan.returnedAt ? 'secondary' : 'destructive'}
            className="text-[11px] py-0"
          >
            Annan hyresgäst
          </Badge>
        ))}

      {loan.contactPerson && (
        <span className="text-muted-foreground">
          Kontaktperson: {loan.contactPerson}
        </span>
      )}

      {loan.pickedUpAt ? (
        <span className="text-muted-foreground">
          Upphämtad:{' '}
          {format(new Date(loan.pickedUpAt), 'd MMM yyyy', { locale: sv })}
        </span>
      ) : loan.createdAt ? (
        <>
          <span className="text-muted-foreground">
            Utlånad:{' '}
            {format(new Date(loan.createdAt), 'd MMM yyyy', { locale: sv })}
          </span>
          <span className="text-muted-foreground font-semibold">
            Ej upphämtat
          </span>
        </>
      ) : null}

      {loan.returnedAt && (
        <span className="text-muted-foreground">
          Återlämnad:{' '}
          {format(new Date(loan.returnedAt), 'd MMM yyyy', { locale: sv })}
        </span>
      )}
    </div>
  )
}
