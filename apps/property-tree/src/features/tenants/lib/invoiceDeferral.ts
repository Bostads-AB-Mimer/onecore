import { Invoice, PaymentStatus } from '@onecore/types'
import { z } from 'zod'

import type { DeferralError } from '@/services/api/core/economyService'

export const deferralFormSchema = z.object({
  endDate: z.date({ required_error: 'Välj ett förfallodatum' }),
  reason: z.string().min(1, 'Ange en anledning'),
})

export type DeferralFormValues = z.infer<typeof deferralFormSchema>

export const deferralErrorMessages: Record<DeferralError['code'], string> = {
  'invoice-not-found': 'Fakturan hittades inte i Tenfast.',
  'invoice-not-eligible':
    'Fakturan kan inte beviljas anstånd i nuvarande status.',
  'xledger-failed':
    'Anståndet registrerades i Tenfast men misslyckades i Xledger. Ekonomiteamet har notifierats.',
  'tenfast-failed':
    'Anståndet kunde inte registreras i Tenfast. Ekonomiteamet har notifierats.',
}

export function canGrantInvoiceDeferral(invoice: Invoice): boolean {
  return (
    invoice.source === 'next' &&
    invoice.paymentStatus !== PaymentStatus.Paid &&
    !invoice.credit
  )
}

export function hasInvoiceDeferral(invoice: Invoice): boolean {
  return !!invoice.deferral
}

export type InvoiceDeferralSummaryLine = {
  label: string
  value: string
}

const formatDeferralDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString().slice(0, 10)
}

export function getInvoiceDeferralTooltip(
  deferral: NonNullable<Invoice['deferral']>
): string {
  if (deferral.madeBy) {
    return `Beviljat av ${deferral.madeBy}`
  }

  return 'Anstånd beviljat'
}

export function getInvoiceDeferralSummaryLines(
  deferral: NonNullable<Invoice['deferral']>
): InvoiceDeferralSummaryLine[] {
  const lines: InvoiceDeferralSummaryLine[] = [
    {
      label: 'Nytt förfallodatum',
      value: formatDeferralDate(deferral.endDate),
    },
  ]

  if (deferral.madeBy) {
    lines.push({
      label: 'Beviljat av',
      value: deferral.madeBy,
    })
  }

  if (deferral.reason) {
    lines.push({
      label: 'Anledning',
      value: deferral.reason,
    })
  }

  return lines
}
