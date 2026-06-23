import { Invoice } from '@onecore/types'

export type TenfastDeferralSource = {
  reason: string
  madeBy: string
}

export function buildInvoiceDeferral(sources: {
  defermentEndDate?: Date
  tenfastDeferral?: TenfastDeferralSource
}): NonNullable<Invoice['deferral']> | undefined {
  if (!sources.defermentEndDate) {
    return undefined
  }

  return {
    endDate: sources.defermentEndDate,
    reason: sources.tenfastDeferral?.reason ?? '',
    madeBy: sources.tenfastDeferral?.madeBy ?? '',
  }
}

export function withInvoiceDeferral(
  invoice: Invoice,
  sources: {
    defermentEndDate?: Date
    tenfastDeferral?: TenfastDeferralSource
  }
): Invoice {
  const deferral = buildInvoiceDeferral(sources)
  return deferral ? { ...invoice, deferral } : invoice
}
