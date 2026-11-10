import {
  buildInvoiceDeferral,
  withInvoiceDeferral,
} from '@src/common/invoice-deferral'
import * as factory from '@test/factories'

describe('invoice-deferral', () => {
  it('builds deferral from xledger end date with empty tenfast metadata', () => {
    expect(
      buildInvoiceDeferral({ defermentEndDate: new Date('2026-06-30') })
    ).toEqual({
      endDate: new Date('2026-06-30'),
      reason: '',
      madeBy: '',
    })
  })

  it('uses xledger end date and tenfast metadata when both exist', () => {
    expect(
      buildInvoiceDeferral({
        defermentEndDate: new Date('2026-07-15'),
        tenfastDeferral: {
          reason: 'Betalningsplan',
          madeBy: 'admin@mimer.nu',
        },
      })
    ).toEqual({
      endDate: new Date('2026-07-15'),
      reason: 'Betalningsplan',
      madeBy: 'admin@mimer.nu',
    })
  })

  it('returns undefined when only tenfast has grace period metadata', () => {
    expect(
      buildInvoiceDeferral({
        tenfastDeferral: {
          reason: 'Betalningsplan',
          madeBy: 'admin@mimer.nu',
        },
      })
    ).toBeUndefined()
  })

  it('returns undefined when no deferral sources exist', () => {
    expect(buildInvoiceDeferral({})).toBeUndefined()
  })

  it('attaches deferral to invoice only when xledger has deferment end date', () => {
    const invoice = factory.invoice.build({ invoiceId: '55123456' })

    expect(
      withInvoiceDeferral(invoice, {
        defermentEndDate: new Date('2026-07-15'),
        tenfastDeferral: {
          reason: 'Betalningsplan',
          madeBy: 'admin@mimer.nu',
        },
      })
    ).toEqual({
      ...invoice,
      deferral: {
        endDate: new Date('2026-07-15'),
        reason: 'Betalningsplan',
        madeBy: 'admin@mimer.nu',
      },
    })
  })
})
