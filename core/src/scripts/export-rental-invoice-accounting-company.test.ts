import { economy } from '@onecore/types'

import { exportRentalInvoiceAccountingForCompany } from './export-rental-invoice-accounting-company'
import type { CustomerCreationReport } from './export-rental-invoice-accounting-customers'

const COMPANY_ID = '001'

const batch = (
  overrides: Partial<economy.ImportInvoicesResponse> = {}
): economy.ImportInvoicesResponse => ({
  errors: [],
  successfulInvoices: [],
  skippedInvoices: [],
  markFailures: [],
  missingCustomerCodes: [],
  ...overrides,
})

const customers = (
  overrides: Partial<CustomerCreationReport> = {}
): CustomerCreationReport => ({
  created: [],
  updated: [],
  failed: [],
  ...overrides,
})

const missingCustomerError = (
  invoiceNumber: string
): economy.RentalInvoiceExportError => ({
  invoiceNumber,
  code: 'missing-customer',
  error: 'Kunden finns inte i Xledger',
})

const setup = ({
  batches,
  upFront = { ...customers(), attempted: [] },
  creates = [],
}: {
  batches: Array<
    | { ok: true; data: economy.ImportInvoicesResponse }
    | { ok: false; err: 'export-failed'; detail?: string }
  >
  upFront?: CustomerCreationReport & { attempted: string[] }
  creates?: CustomerCreationReport[]
}) => {
  const importInvoices = jest.fn()
  for (const result of batches) importInvoices.mockResolvedValueOnce(result)
  importInvoices.mockResolvedValue({ ok: true, data: batch() })

  const createMissingInvoiceRecipients = jest.fn().mockResolvedValue(upFront)

  const createInvoiceRecipients = jest.fn()
  for (const result of creates)
    createInvoiceRecipients.mockResolvedValueOnce(result)
  createInvoiceRecipients.mockResolvedValue(customers())

  return {
    importInvoices,
    createMissingInvoiceRecipients,
    createInvoiceRecipients,
  }
}

describe('exportRentalInvoiceAccountingForCompany', () => {
  it('creates missing recipients up front, then imports until a batch exports nothing', async () => {
    const deps = setup({
      upFront: { ...customers({ created: ['P2'] }), attempted: ['P2'] },
      batches: [
        { ok: true, data: batch({ successfulInvoices: ['1', '2'] }) },
        { ok: true, data: batch() },
      ],
    })

    const report = await exportRentalInvoiceAccountingForCompany(
      COMPANY_ID,
      deps
    )

    expect(deps.createMissingInvoiceRecipients).toHaveBeenCalledTimes(1)
    expect(deps.createMissingInvoiceRecipients.mock.calls[0][0]).toBe(
      COMPANY_ID
    )
    expect(
      deps.createMissingInvoiceRecipients.mock.invocationCallOrder[0]
    ).toBeLessThan(deps.importInvoices.mock.invocationCallOrder[0])
    expect(deps.importInvoices).toHaveBeenCalledTimes(2)
    expect(deps.importInvoices).toHaveBeenCalledWith(COMPANY_ID)
    expect(deps.createInvoiceRecipients).not.toHaveBeenCalled()
    expect(report.exportedCount).toBe(2)
    expect(report.customers).toEqual({
      created: ['P2'],
      updated: [],
      failed: [],
    })
  })

  it('calls again when a batch exports nothing but a new held-back recipient was created', async () => {
    const deps = setup({
      batches: [
        {
          ok: true,
          data: batch({
            errors: [missingCustomerError('7')],
            missingCustomerCodes: ['P5'],
          }),
        },
        { ok: true, data: batch({ successfulInvoices: ['7'] }) },
        { ok: true, data: batch() },
      ],
      creates: [customers({ created: ['P5'] })],
    })

    const report = await exportRentalInvoiceAccountingForCompany(
      COMPANY_ID,
      deps
    )

    expect(deps.createInvoiceRecipients).toHaveBeenCalledTimes(1)
    expect(deps.createInvoiceRecipients.mock.calls[0][0]).toEqual(['P5'])
    expect(deps.importInvoices).toHaveBeenCalledTimes(3)
    expect(report.exportedCount).toBe(1)
    expect([...report.errors.values()]).toEqual([])
    expect(report.customers).toEqual({
      created: ['P5'],
      updated: [],
      failed: [],
    })
  })

  it('stops when the create for a held-back recipient fails and the batch exported nothing', async () => {
    const deps = setup({
      batches: [
        {
          ok: true,
          data: batch({
            errors: [missingCustomerError('7')],
            missingCustomerCodes: ['P5'],
          }),
        },
      ],
      creates: [
        customers({
          failed: [{ contactCode: 'P5', reason: 'contact-not-found' }],
        }),
      ],
    })

    const report = await exportRentalInvoiceAccountingForCompany(
      COMPANY_ID,
      deps
    )

    expect(deps.createInvoiceRecipients).toHaveBeenCalledTimes(1)
    expect(deps.createInvoiceRecipients.mock.calls[0][0]).toEqual(['P5'])
    expect(deps.importInvoices).toHaveBeenCalledTimes(1)
    expect(report.customers.failed).toEqual([
      { contactCode: 'P5', reason: 'contact-not-found' },
    ])
    expect([...report.errors.values()]).toEqual([missingCustomerError('7')])
  })

  it('does not create a held-back recipient again when the up-front step already tried it', async () => {
    const deps = setup({
      upFront: {
        ...customers({
          failed: [{ contactCode: 'P2', reason: 'sync-failed' }],
        }),
        attempted: ['P2'],
      },
      batches: [
        {
          ok: true,
          data: batch({
            errors: [missingCustomerError('8')],
            missingCustomerCodes: ['P2'],
          }),
        },
      ],
    })

    const report = await exportRentalInvoiceAccountingForCompany(
      COMPANY_ID,
      deps
    )

    expect(deps.createInvoiceRecipients).not.toHaveBeenCalled()
    expect(deps.importInvoices).toHaveBeenCalledTimes(1)
    expect(report.customers).toEqual({
      created: [],
      updated: [],
      failed: [{ contactCode: 'P2', reason: 'sync-failed' }],
    })
  })

  it('still runs the import loop when the up-front lookup fails', async () => {
    const deps = setup({
      upFront: {
        ...customers({ lookupFailure: 'xledger-failed: timeout' }),
        attempted: [],
      },
      batches: [
        { ok: true, data: batch({ successfulInvoices: ['1'] }) },
        { ok: true, data: batch() },
      ],
    })

    const report = await exportRentalInvoiceAccountingForCompany(
      COMPANY_ID,
      deps
    )

    expect(deps.importInvoices).toHaveBeenCalledTimes(2)
    expect(report.exportedCount).toBe(1)
    expect(report.customers.lookupFailure).toBe('xledger-failed: timeout')
  })

  it('stops at once when a batch has mark failures', async () => {
    const deps = setup({
      batches: [
        {
          ok: true,
          data: batch({
            successfulInvoices: ['1', '2'],
            markFailures: [{ invoiceNumber: '2', error: 'request-failed' }],
          }),
        },
      ],
    })

    const report = await exportRentalInvoiceAccountingForCompany(
      COMPANY_ID,
      deps
    )

    expect(deps.importInvoices).toHaveBeenCalledTimes(1)
    expect(report.exportedCount).toBe(2)
    expect(report.markFailures).toEqual([
      { invoiceNumber: '2', error: 'request-failed' },
    ])
  })

  it('sets the failure when importInvoices fails', async () => {
    const deps = setup({
      batches: [{ ok: false, err: 'export-failed', detail: 'boom' }],
    })

    const report = await exportRentalInvoiceAccountingForCompany(
      COMPANY_ID,
      deps
    )

    expect(deps.importInvoices).toHaveBeenCalledTimes(1)
    expect(report.failure).toEqual({ err: 'export-failed', detail: 'boom' })
    expect(report.exportedCount).toBe(0)
  })
})
