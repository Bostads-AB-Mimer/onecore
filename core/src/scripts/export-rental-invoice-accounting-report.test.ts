import {
  addBatchToReport,
  buildExportReportEmail,
  createCompanyExportReport,
} from './export-rental-invoice-accounting-report'

const startedAt = new Date('2026-11-04T05:00:00Z')
const finishedAt = new Date('2026-11-04T05:10:00Z')

const emptyBatch = {
  errors: [],
  successfulInvoices: [],
  skippedInvoices: [],
  markFailures: [],
}

describe('addBatchToReport', () => {
  it('sums counts across batches and keeps one entry per repeated error', () => {
    const report = createCompanyExportReport('001')
    const error = { invoiceNumber: '9', error: 'Saknar konto' }

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
      errors: [{ invoiceNumber: '9', error: 'Saknar konto' }],
    })

    const { subject, body } = buildExportReportEmail(
      [report],
      startedAt,
      finishedAt
    )

    expect(subject).toBe('Fel i körning: export av hyresavier till Xledger')
    expect(body).toContain('Avier med fel (exporterades inte):')
    expect(body).toContain('- 9: Saknar konto')
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
