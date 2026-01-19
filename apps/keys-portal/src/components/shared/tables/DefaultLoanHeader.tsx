import React from 'react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { KeyLoan } from '@/services/types'

export interface DefaultLoanHeaderProps {
  /** The loan data to display */
  loan: KeyLoan
  /** Optional company names lookup for displaying contact names */
  companyNames?: Record<string, string>
}

/**
 * Default loan header component for displaying loan information in collapsible sections.
 * Shows loan type badge, contact info, and relevant dates.
 *
 * @example
 * ```tsx
 * <DefaultLoanHeader loan={loan} companyNames={companyNames} />
 * ```
 */
export function DefaultLoanHeader({
  loan,
  companyNames = {},
}: DefaultLoanHeaderProps) {
  const contactDisplay = loan.contact
    ? companyNames[loan.contact] || loan.contact
    : null

  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline">
        {loan.loanType === 'TENANT' ? 'Hyresgästlån' : 'Underhållslån'}
      </Badge>

      {contactDisplay && (
        <span className="text-muted-foreground">Kontakt: {contactDisplay}</span>
      )}

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
