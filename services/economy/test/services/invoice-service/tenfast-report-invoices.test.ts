import {
  getTenfastInvoicesByOcr,
  toLeaseDetails,
  toRentInvoiceRows,
} from '@src/services/invoice-service/tenfast-report-invoices'
import {
  fetchTenfastInvoiceByOcr,
  getArticleCodesById,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import {
  getLatestCostCentreYear,
  getPropertyCodeAndCostCentreForLease,
} from '@src/services/common/adapters/xpand-db-adapter'
import { TenfastInvoice } from '@src/common/adapters/tenfast/schemas'
import {
  TenfastInvoiceFactory,
  TenfastInvoiceRowFactory,
} from '../../factories/tenfast'

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () => ({
  fetchTenfastInvoiceByOcr: jest.fn(),
  getArticleCodesById: jest.fn(),
}))
jest.mock('@src/services/common/adapters/xpand-db-adapter', () => ({
  getPropertyCodeAndCostCentreForLease: jest.fn(),
  getLatestCostCentreYear: jest.fn(),
}))

const mockFetch = fetchTenfastInvoiceByOcr as jest.Mock
const mockArticleCodes = getArticleCodesById as jest.Mock
const mockCostCentre = getPropertyCodeAndCostCentreForLease as jest.Mock
const mockLatestYear = getLatestCostCentreYear as jest.Mock

type Lease = TenfastInvoice['avtal'][number]

// A lease on a rental object; housing has a skvNummer, parking does not
const lease = (
  externalId: string,
  rentalObjectCode: string,
  skvNummer: number | null
): Lease => {
  const [template] = TenfastInvoiceFactory.build().avtal
  return {
    ...template,
    externalId,
    hyresobjekt: [
      { ...template.hyresobjekt[0], externalId: rentalObjectCode, skvNummer },
    ],
  }
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe(getTenfastInvoicesByOcr, () => {
  it('returns found invoices with the OCR number they were looked up by', async () => {
    const invoice = TenfastInvoiceFactory.build({ ocrNumber: undefined })
    mockFetch.mockResolvedValueOnce({ ok: true, data: invoice })

    const result = await getTenfastInvoicesByOcr(['5512'])

    expect(result).toEqual([{ ocr: '5512', invoice }])
  })

  it('leaves out invoices that are not in Tenfast or fail the schema', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })
      .mockResolvedValueOnce({ ok: false, err: 'schema-error' })

    const result = await getTenfastInvoicesByOcr(['5511', '5512'])

    expect(result).toEqual([])
  })

  it('throws when Tenfast cannot be reached, so the report is not silently incomplete', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, err: 'unknown' })

    await expect(getTenfastInvoicesByOcr(['5511'])).rejects.toThrow('5511')
  })
})

describe(toRentInvoiceRows, () => {
  it('maps the rows to the Xpand shape the reports read', async () => {
    mockArticleCodes.mockResolvedValueOnce(
      new Map([
        ['article-hemfor', 'HEMFÖR'],
        ['article-rent', 'BASHYRM'],
      ])
    )
    const invoice = TenfastInvoiceFactory.build({
      interval: { from: '2026-12-01', to: '2026-12-31' },
      hyror: [
        TenfastInvoiceRowFactory.build({
          article: 'article-hemfor',
          label: 'Mimers hemförsäkring',
          amount: 80,
          vat: 0,
          consolidationLabel: null,
        }),
        TenfastInvoiceRowFactory.build({
          article: 'article-rent',
          amount: 13571.5,
          vat: 0.25,
        }),
      ],
    })

    const rows = await toRentInvoiceRows([{ ocr: '5512', invoice }])

    expect(rows).toEqual([
      expect.objectContaining({
        invoiceNumber: '5512',
        code: 'HEMFÖR',
        rentType: 'Hemförsäkring',
        text: 'Mimers hemförsäkring',
        amount: 80,
        vat: 0,
        reduction: 0,
        type: 'Rent',
        printGroup: null,
      }),
      expect.objectContaining({
        invoiceNumber: '5512',
        code: 'BASHYRM',
        rentType: null,
        amount: 13571.5,
        // Tenfast's vat is the rate; the reports want the amount, in öre
        vat: 3392.88,
      }),
    ])
  })

  it('looks the articles up in one call for all invoices', async () => {
    mockArticleCodes.mockResolvedValueOnce(new Map([['a', 'HYRSÄT']]))
    const invoice = TenfastInvoiceFactory.build({
      hyror: [
        TenfastInvoiceRowFactory.build({ article: 'a' }),
        TenfastInvoiceRowFactory.build({ article: null }),
      ],
    })

    const rows = await toRentInvoiceRows([
      { ocr: '5511', invoice },
      { ocr: '5512', invoice },
    ])

    expect(mockArticleCodes).toHaveBeenCalledTimes(1)
    expect(mockArticleCodes).toHaveBeenCalledWith(['a', 'a'])
    expect(rows.map((row) => row.code)).toEqual([
      'HYRSÄT',
      null,
      'HYRSÄT',
      null,
    ])
  })

  it('throws when an article code cannot be looked up, so no invoice is silently left out', async () => {
    mockArticleCodes.mockResolvedValueOnce(new Map())
    const invoice = TenfastInvoiceFactory.build({
      hyror: [TenfastInvoiceRowFactory.build({ article: 'article-hemfor' })],
    })

    await expect(toRentInvoiceRows([{ ocr: '5512', invoice }])).rejects.toThrow(
      'article-hemfor'
    )
  })

  it("uses the invoice's period and empty text when a row has none", async () => {
    mockArticleCodes.mockResolvedValueOnce(new Map())
    const invoice = TenfastInvoiceFactory.build({
      interval: { from: '2026-12-01', to: '2026-12-31' },
      hyror: [
        TenfastInvoiceRowFactory.build({
          article: null,
          label: null,
          from: undefined,
          to: null,
        }),
      ],
    })

    const [row] = await toRentInvoiceRows([{ ocr: '5512', invoice }])

    expect(row).toEqual(
      expect.objectContaining({
        code: null,
        text: '',
        fromDate: new Date('2026-12-01'),
        toDate: new Date('2026-12-31'),
      })
    )
  })
})

describe(toLeaseDetails, () => {
  beforeEach(() => {
    mockLatestYear.mockResolvedValue(2026)
  })

  it("puts the housing lease first and looks the cost centre up for Xpand's latest year", async () => {
    mockCostCentre.mockImplementation(async (rentalId: string) =>
      rentalId === '216-703-00-0018'
        ? { costCentre: '61110', propertyCode: '01216' }
        : { costCentre: '61120', propertyCode: '01216' }
    )
    const invoice = TenfastInvoiceFactory.build({
      avtal: [
        lease('216-703-00-0101/01', '216-703-00-0101', null),
        lease('216-703-00-0018/01', '216-703-00-0018', 2104),
      ],
    })

    const [result] = await toLeaseDetails([{ ocr: '5512', invoice }])

    expect(result).toEqual({
      invoiceId: '5512',
      details: [
        { leaseId: '216-703-00-0018/01', costCentre: '61110' },
        { leaseId: '216-703-00-0101/01', costCentre: '61120' },
      ],
    })
    expect(mockLatestYear).toHaveBeenCalledTimes(1)
    expect(mockCostCentre).toHaveBeenCalledWith('216-703-00-0018', 2026)
    expect(mockCostCentre).toHaveBeenCalledWith('216-703-00-0101', 2026)
  })

  it("keeps Tenfast's order when no lease has a skvNummer", async () => {
    mockCostCentre.mockResolvedValue(null)
    const invoice = TenfastInvoiceFactory.build({
      avtal: [
        lease('first/01', 'first', null),
        lease('second/01', 'second', null),
      ],
    })

    const [result] = await toLeaseDetails([{ ocr: '5512', invoice }])

    expect(result.details).toEqual([
      { leaseId: 'first/01', costCentre: null },
      { leaseId: 'second/01', costCentre: null },
    ])
  })

  it('looks each rental object up once', async () => {
    mockCostCentre.mockResolvedValue({
      costCentre: '61110',
      propertyCode: '01216',
    })
    const invoice = TenfastInvoiceFactory.build({
      avtal: [lease('216-703-00-0018/01', '216-703-00-0018', 2104)],
    })

    const results = await toLeaseDetails([
      { ocr: '5511', invoice },
      { ocr: '5512', invoice },
    ])

    expect(mockCostCentre).toHaveBeenCalledTimes(1)
    expect(results.map((r) => r.details[0].costCentre)).toEqual([
      '61110',
      '61110',
    ])
  })

  it('does not look the year up when there are no invoices', async () => {
    await expect(toLeaseDetails([])).resolves.toEqual([])

    expect(mockLatestYear).not.toHaveBeenCalled()
  })
})
