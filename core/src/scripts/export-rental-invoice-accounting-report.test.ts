import { economy } from '@onecore/types'

import {
  addBatchToReport,
  addCustomersToReport,
  buildExportReportEmail,
  createCompanyExportReport,
  groupExportErrors,
  summarizeExportErrorsForLog,
} from './export-rental-invoice-accounting-report'

const startedAt = new Date('2026-11-04T05:00:00Z')
const finishedAt = new Date('2026-11-04T05:10:00Z')

const emptyBatch = {
  errors: [],
  successfulInvoices: [],
  skippedInvoices: [],
  markFailures: [],
  missingCustomerCodes: [],
}

describe('addBatchToReport', () => {
  it('sums counts across batches and keeps one entry per repeated error', () => {
    const report = createCompanyExportReport('001')
    const error: economy.RentalInvoiceExportError = {
      invoiceNumber: '9',
      code: 'accounting-failed',
      error: 'Saknar konto',
    }

    addBatchToReport(report, {
      ...emptyBatch,
      successfulInvoices: ['1', '2'],
      skippedInvoices: ['I1'],
      errors: [error],
    })
    addBatchToReport(report, {
      ...emptyBatch,
      successfulInvoices: ['3'],
      errors: [error],
      markFailures: [{ invoiceNumber: '3', error: 'request-failed' }],
    })

    expect(report.exportedCount).toBe(3)
    expect(report.skippedCount).toBe(1)
    expect([...report.errors.values()]).toEqual([error])
    expect(report.markFailures).toEqual([
      { invoiceNumber: '3', error: 'request-failed' },
    ])
  })
})

describe('buildExportReportEmail', () => {
  it('reports the number of exported invoices on a successful run', () => {
    const first = createCompanyExportReport('001')
    addBatchToReport(first, { ...emptyBatch, successfulInvoices: ['1', '2'] })
    const second = createCompanyExportReport('006')
    addBatchToReport(second, { ...emptyBatch, successfulInvoices: ['3'] })

    const { subject, body } = buildExportReportEmail(
      [first, second],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Körning: export av hyresavier till Xledger')
    expect(body).toContain('Totalt exporterade avier: 3')
    expect(body).toContain('Företag 001')
    expect(body).toContain('Exporterade avier: 2')
    expect(body).toContain('Körning startad: 2026-11-04 06:00:00')
  })

  it('sends a report also when nothing was exported', () => {
    const { subject, body } = buildExportReportEmail(
      [createCompanyExportReport('001')],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Körning: export av hyresavier till Xledger')
    expect(body).toContain('Totalt exporterade avier: 0')
  })

  it('lists invoices that could not be marked as exported', () => {
    const report = createCompanyExportReport('001')
    addBatchToReport(report, {
      ...emptyBatch,
      successfulInvoices: ['1', '2'],
      markFailures: [
        { invoiceNumber: '1', error: 'request-failed', status: 503 },
        { invoiceNumber: '2', error: 'missing-external-id' },
      ],
    })

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Fel i körning: export av hyresavier till Xledger')
    expect(body).toContain(
      '- 1: anropet till Tenfast misslyckades (status 503)'
    )
    expect(body).toContain('- 2: saknar Tenfast-id')
  })

  it('lists invoices left out because of errors', () => {
    const report = createCompanyExportReport('001')
    addBatchToReport(report, {
      ...emptyBatch,
      errors: [
        {
          invoiceNumber: '9',
          code: 'accounting-failed',
          error: 'Saknar konto',
        },
      ],
    })

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Fel i körning: export av hyresavier till Xledger')
    expect(body).toContain('Avier med fel (exporterades inte): 1')
    expect(body).toContain('Konteringen misslyckades (1 avi):')
    expect(body).toContain('- 9: Saknar konto')
  })

  it('groups errors by rent article and caps the listed invoices', () => {
    const report = createCompanyExportReport('001')
    const invoiceNumbers = Array.from({ length: 12 }, (_, i) => `${i + 1}`)
    addBatchToReport(report, {
      ...emptyBatch,
      errors: [
        ...invoiceNumbers.map((invoiceNumber) => ({
          invoiceNumber,
          code: 'rent-article-not-found' as const,
          rentArticle: 'A1',
          error: 'Hyresartikeln A1 finns inte i Tenfast',
        })),
        {
          invoiceNumber: '13',
          code: 'rent-article-not-found',
          rentArticle: 'A2',
          error: 'Hyresartikeln A2 finns inte i Tenfast',
        },
      ],
    })

    const { body } = buildExportReportEmail([report], startedAt, finishedAt)

    expect(body).toContain('Avier med fel (exporterades inte): 13')
    expect(body).toContain('Hyresartikeln finns inte i Tenfast (13 avier):')
    expect(body).toContain(
      '- Hyresartikel A1: 12 avier (1, 2, 3, 4, 5, 6, 7, 8, 9, 10 och 2 till)'
    )
    expect(body).toContain('- Hyresartikel A2: 1 avi (13)')
  })

  it('names the uploaded files after a partial upload', () => {
    const report = {
      ...createCompanyExportReport('001'),
      failure: {
        err: 'partial-upload' as const,
        detail: '001/GL-HYRESAVISERING_-1-001-aggregated.gl.csv',
      },
    }

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Fel i körning: export av hyresavier till Xledger')
    expect(body).toContain(
      'Uppladdade filer: 001/GL-HYRESAVISERING_-1-001-aggregated.gl.csv'
    )
  })

  it('reports a failed export with its reason', () => {
    const report = {
      ...createCompanyExportReport('001'),
      failure: { err: 'export-failed' as const, detail: 'Xpand timeout' },
    }

    const { body } = buildExportReportEmail([report], startedAt, finishedAt)

    expect(body).toContain(
      'Körningen avbröts: exporten misslyckades. Xpand timeout'
    )
  })
})

describe('held-back invoices', () => {
  const heldBack = (
    invoiceNumber: string
  ): economy.RentalInvoiceExportError => ({
    invoiceNumber,
    code: 'missing-customer',
    error: 'Kunden P5 finns inte i Xledger',
  })

  it('drops a held-back invoice from the errors once a later batch exports it', () => {
    const report = createCompanyExportReport('001')
    addBatchToReport(report, {
      ...emptyBatch,
      errors: [heldBack('7')],
      missingCustomerCodes: ['P5'],
    })
    addBatchToReport(report, { ...emptyBatch, successfulInvoices: ['7'] })

    expect(report.exportedCount).toBe(1)
    expect([...report.errors.values()]).toEqual([])
  })

  it('lists only the invoices still held back at the end of the run', () => {
    const report = createCompanyExportReport('001')
    addBatchToReport(report, {
      ...emptyBatch,
      errors: [heldBack('7'), heldBack('8')],
      missingCustomerCodes: ['P5'],
    })
    addBatchToReport(report, { ...emptyBatch, successfulInvoices: ['7'] })

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Fel i körning: export av hyresavier till Xledger')
    expect(body).toContain('Avier med fel (exporterades inte): 1')
    expect(body).toContain('Kunden finns inte i Xledger (1 avi):')
    expect(body).toContain('- 8: Kunden P5 finns inte i Xledger')
    expect(body).not.toContain('- 7: Kunden P5 finns inte i Xledger')
  })
})

describe('customers in the report', () => {
  it('starts every company with an empty customer section', () => {
    expect(createCompanyExportReport('001').customers).toEqual({
      created: [],
      updated: [],
      failed: [],
    })
  })

  it('lists the customers the run created and keeps the plain subject', () => {
    const report = createCompanyExportReport('001')
    addBatchToReport(report, { ...emptyBatch, successfulInvoices: ['1'] })
    addCustomersToReport(report, {
      created: ['P1', 'P2'],
      updated: [],
      failed: [],
    })

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Körning: export av hyresavier till Xledger')
    expect(body).toContain('Nya kunder i Xledger: 2')
    expect(body.some((line) => line.includes('P1, P2'))).toBe(true)
  })

  it('names a customer missing in the contact register and flags the run', () => {
    const report = createCompanyExportReport('001')
    addCustomersToReport(report, {
      created: [],
      updated: [],
      failed: [{ contactCode: 'P3', reason: 'contact-not-found' }],
    })

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Fel i körning: export av hyresavier till Xledger')
    expect(
      body.some((line) => line.includes('P3') && /kontaktregistret/i.test(line))
    ).toBe(true)
  })

  it('says the customer check could not run and flags the run', () => {
    const report = createCompanyExportReport('001')
    addCustomersToReport(report, {
      created: [],
      updated: [],
      failed: [],
      lookupFailure: 'xledger-failed',
    })

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Fel i körning: export av hyresavier till Xledger')
    expect(
      body.some((line) => /kunderna kunde inte kontrolleras/i.test(line))
    ).toBe(true)
    expect(body.some((line) => line.includes('xledger-failed'))).toBe(true)
  })

  it('caps the listed customer codes', () => {
    const report = createCompanyExportReport('001')
    const created = Array.from({ length: 120 }, (_, i) => `P${i + 1}`)
    addCustomersToReport(report, { created, updated: [], failed: [] })

    const { body } = buildExportReportEmail([report], startedAt, finishedAt)

    expect(body).toContain('Nya kunder i Xledger: 120')
    const listed = body.find((line) => line.includes('och 110 till'))
    expect(listed).toContain(created.slice(0, 10).join(', '))
    expect(listed).not.toContain('P11')
  })

  it('leaves the body as before when no customer was touched', () => {
    const plain = createCompanyExportReport('001')
    addBatchToReport(plain, { ...emptyBatch, successfulInvoices: ['1'] })
    const withEmptyCustomers = createCompanyExportReport('001')
    addBatchToReport(withEmptyCustomers, {
      ...emptyBatch,
      successfulInvoices: ['1'],
    })
    addCustomersToReport(withEmptyCustomers, {
      created: [],
      updated: [],
      failed: [],
    })

    const before = buildExportReportEmail([plain], startedAt, finishedAt)
    const after = buildExportReportEmail(
      [withEmptyCustomers],
      startedAt,
      finishedAt
    )

    expect(after).toEqual(before)
    expect(
      after.body.some((line) =>
        /kunder i Xledger|kontaktregistret|kontrolleras|uppdaterade|kunde inte skapas/i.test(
          line
        )
      )
    ).toBe(false)
  })
})

describe('groupExportErrors', () => {
  it('counts each invoice once per code, largest group first', () => {
    const groups = groupExportErrors([
      {
        invoiceNumber: '1',
        code: 'missing-rental-object',
        rentArticle: 'HYRA',
        error: 'Saknar hyresobjekt',
      },
      {
        invoiceNumber: '2',
        code: 'rent-article-not-found',
        rentArticle: 'A1',
        error: 'Finns inte',
      },
      {
        invoiceNumber: '2',
        code: 'rent-article-not-found',
        rentArticle: 'A2',
        error: 'Finns inte',
      },
      {
        invoiceNumber: '3',
        code: 'rent-article-not-found',
        rentArticle: 'A1',
        error: 'Finns inte',
      },
    ])

    expect(groups.map((group) => group.code)).toEqual([
      'rent-article-not-found',
      'missing-rental-object',
    ])
    expect(groups[0].invoiceNumbers).toEqual(['2', '3'])
    expect(groups[0].byRentArticle).toEqual(
      new Map([
        ['A1', ['2', '3']],
        ['A2', ['2']],
      ])
    )
  })
})

describe('summarizeExportErrorsForLog', () => {
  it('reports invoice counts per code and rent article', () => {
    expect(
      summarizeExportErrorsForLog([
        {
          invoiceNumber: '1',
          code: 'rent-article-not-found',
          rentArticle: 'A1',
          error: 'Finns inte',
        },
        {
          invoiceNumber: '2',
          code: 'rent-article-not-found',
          rentArticle: 'A1',
          error: 'Finns inte',
        },
        { invoiceNumber: '3', code: 'accounting-failed', error: 'Fel' },
      ])
    ).toEqual({
      'rent-article-not-found': { invoices: 2, rentArticles: { A1: 2 } },
      'accounting-failed': { invoices: 1, rentArticles: {} },
    })
  })
})
