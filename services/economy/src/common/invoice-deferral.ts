import { Invoice } from '@onecore/types'
import { logger } from '@onecore/utilities'

export type TenfastDeferralSource = {
  reason: string
  madeBy: string
}

export function buildInvoiceDeferral(sources: {
  defermentEndDate?: Date
  tenfastDeferral?: TenfastDeferralSource
}): NonNullable<Invoice['deferral']> | undefined {
  if (!sources.defermentEndDate) {
    if (sources.tenfastDeferral) {
      logger.warn(
        { tenfastDeferral: sources.tenfastDeferral },
        'deferral: no public deferral — Tenfast grace period present but missing Xledger deferment end date'
      )
    }
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
