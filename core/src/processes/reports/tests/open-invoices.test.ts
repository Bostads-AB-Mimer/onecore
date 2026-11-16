import { economy, LeaseStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as factory from '../../../../test/factories'
import {
  daysBetween,
  getOpenInvoiceReport,
  OpenInvoiceReportDeps,
  toOpenInvoiceExcelRow,
} from '../open-invoices'

const buildInvoice = (
  overrides: Partial<economy.OpenInvoice> = {}
): economy.OpenInvoice => ({
  invoiceNumber: '55123456',
  ocr: '5512345601',
  invoiceDate: '2026-10-15',
  dueDate: '2026-11-01',
  amount: 8000,
  remainingAmount: 5000,
  rentalObjectCode: '306-008-01-0201',
  leaseId: '306-008-01-0201/02',
  contactCode: 'P100001',
  state: 'overdue',
  costCentre: '61110',
  ...overrides,
})

const contact = factory.domainContact.build({
  contactCode: 'P100001',
  addresses: [
    {
      street: 'Testgatan 1',
      zipCode: '72216',
      city: 'Västerås',
      region: null,
      country: null,
      full: null,
    },
  ],
})

const buildDeps = (
  overrides: Partial<OpenInvoiceReportDeps> = {}
): OpenInvoiceReportDeps => ({
  getOpenInvoices: jest
    .fn()
    .mockResolvedValue({ ok: true, data: [buildInvoice()] }),
  getLeaseStatuses: jest.fn().mockResolvedValue({
    ok: true,
    data: {
      statuses: [
        { leaseId: '306-008-01-0201/02', status: LeaseStatus.AboutToEnd },
      ],
      notFoundLeaseIds: [],
    },
  }),
  contacts: {
    getByContactCodeBatch: jest
      .fn()
      .mockResolvedValue({ ok: true, data: [contact] }),
  },
  today: () => '2026-11-13',
  ...overrides,
})

afterEach(jest.restoreAllMocks)

describe(getOpenInvoiceReport, () => {
  it('adds the lease status, the name and address and the days past due', async () => {
    const deps = buildDeps()

    const result = await getOpenInvoiceReport(deps)

    expect(result).toEqual({
      ok: true,
      data: [
        {
          ...buildInvoice(),
          leaseStatus: LeaseStatus.AboutToEnd,
          fullName: 'Kansen, Knut',
          address: 'Testgatan 1',
          daysPastDue: 12,
        },
      ],
    })
    expect(deps.contacts?.getByContactCodeBatch).toHaveBeenCalledWith(
      ['P100001'],
      { includeAddress: true }
    )
  })

  it('orders by due date, oldest first and without a due date last', async () => {
    const deps = buildDeps({
      getOpenInvoices: jest.fn().mockResolvedValue({
        ok: true,
        data: [
          buildInvoice({ invoiceNumber: 'none', dueDate: null }),
          buildInvoice({ invoiceNumber: 'late-b', dueDate: '2026-12-01' }),
          buildInvoice({ invoiceNumber: 'early', dueDate: '2026-09-01' }),
          buildInvoice({ invoiceNumber: 'late-a', dueDate: '2026-12-01' }),
        ],
      }),
    })

    const result = await getOpenInvoiceReport(deps)

    expect(
      result.ok &&
        result.data.map((row) => [row.invoiceNumber, row.daysPastDue])
    ).toEqual([
      ['early', 73],
      ['late-a', -18],
      ['late-b', -18],
      ['none', null],
    ])
  })

  it('leaves the status empty for a lease leasing does not have', async () => {
    const deps = buildDeps({
      getLeaseStatuses: jest.fn().mockResolvedValue({
        ok: true,
        data: { statuses: [], notFoundLeaseIds: ['306-008-01-0201/02'] },
      }),
    })

    const result = await getOpenInvoiceReport(deps)

    expect(result.ok && result.data[0].leaseStatus).toBeNull()
  })

  it('matches the lease ID ignoring case and padding', async () => {
    const deps = buildDeps({
      getOpenInvoices: jest.fn().mockResolvedValue({
        ok: true,
        data: [buildInvoice({ leaseId: ' 306-008-01-0201/02 ' })],
      }),
    })

    const result = await getOpenInvoiceReport(deps)

    expect(deps.getLeaseStatuses).toHaveBeenCalledWith(['306-008-01-0201/02'])
    expect(result.ok && result.data[0].leaseStatus).toBe(LeaseStatus.AboutToEnd)
  })

  it('blanks the names when the contacts service fails, and still lists the invoices', async () => {
    jest.spyOn(logger, 'error').mockImplementation()
    const deps = buildDeps({
      contacts: {
        getByContactCodeBatch: jest
          .fn()
          .mockResolvedValue({ ok: false, err: 'unknown' }),
      },
    })

    const result = await getOpenInvoiceReport(deps)

    expect(result.ok && result.data[0]).toMatchObject({
      fullName: null,
      address: null,
      leaseStatus: LeaseStatus.AboutToEnd,
    })
  })

  it.each([
    ['unknown', 'upstream-failed'],
    ['cache-warming', 'cache-warming'],
  ] as const)(
    'fails, never lists a blank status, when leasing fails with %s',
    async (err, expected) => {
      const deps = buildDeps({
        getLeaseStatuses: jest.fn().mockResolvedValue({ ok: false, err }),
      })

      const result = await getOpenInvoiceReport(deps)

      expect(result).toEqual({ ok: false, err: expected })
    }
  )

  it('passes economy failing on', async () => {
    const deps = buildDeps({
      getOpenInvoices: jest
        .fn()
        .mockResolvedValue({ ok: false, err: 'upstream-failed' }),
    })

    const result = await getOpenInvoiceReport(deps)

    expect(result).toEqual({ ok: false, err: 'upstream-failed' })
  })
})

describe(toOpenInvoiceExcelRow, () => {
  it('fills the unpaid invoice report columns', () => {
    expect(
      toOpenInvoiceExcelRow({
        ...buildInvoice(),
        leaseStatus: LeaseStatus.Ended,
        fullName: 'Kansen, Knut',
        address: 'Testgatan 1',
        daysPastDue: 12,
      })
    ).toEqual({
      invoiceId: '55123456',
      invoiceDate: new Date('2026-10-15T00:00:00Z'),
      expirationDate: new Date('2026-11-01T00:00:00Z'),
      invoiceAmount: 8000,
      remainingAmount: 5000,
      daysSinceExpirationDate: 12,
      rentalPropertyId: '306-008-01-0201',
      tenantName: 'Kansen, Knut',
      tenantContactCode: 'P100001',
      address: 'Testgatan 1',
      // An ended lease shows as Uppsagt, as in Xpand's list.
      leaseStatus: 'Uppsagt',
      costCentre: '61110',
    })
  })
})

describe(daysBetween, () => {
  it('counts whole days, negative backwards', () => {
    expect(daysBetween('2026-11-01', '2026-11-13')).toBe(12)
    expect(daysBetween('2026-11-13', '2026-11-01')).toBe(-12)
    // Across the switch to winter time.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })
})
