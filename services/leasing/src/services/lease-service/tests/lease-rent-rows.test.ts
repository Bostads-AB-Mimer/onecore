import { LeaseStatus, leasing } from '@onecore/types'

import * as factory from './factories'
import type { CachedLease } from '../../../common/lease-cache'
import type {
  TenfastArticle,
  YearMonthDayString,
} from '../adapters/tenfast/schemas'
import {
  filterRentRowListItems,
  planHomeInsuranceEndDate,
  toRentRowListItems,
} from '../services/lease-rent-rows'

const HOME_INSURANCE_ID = 'home-insurance-article-id'
const FEE_ID = 'fee-article-id'

// Test dates are written as literal yyyy-mm-dd strings
const ymd = (s: string) => s as YearMonthDayString

const articles: TenfastArticle[] = [
  {
    _id: HOME_INSURANCE_ID,
    code: 'HEMFÖR',
    vat: 0,
    createdAt: '2026-11-03T21:33:37.593Z',
    updatedAt: '2026-11-04T08:00:00.000Z',
  },
  { _id: FEE_ID, code: 'FAKT AVG', vat: 0 },
]

const makeCachedLease = (overrides: Partial<CachedLease>): CachedLease =>
  ({
    leaseId: '000-000-00-0102/01',
    status: LeaseStatus.Current,
    contacts: [
      {
        name: 'Test Testsson',
        contactCode: 'P0182914',
        email: null,
        phone: null,
      },
    ],
    rentRows: [],
    ...overrides,
    // Only the fields the rent row code reads; the rest of the search result is irrelevant here
  }) as CachedLease

const leaseA = makeCachedLease({
  leaseId: '000-000-00-0102/01',
  rentRows: [
    {
      id: 'row-ins',
      articleId: HOME_INSURANCE_ID,
      label: 'Mimers hemförsäkring',
      amount: 92,
      vat: 0,
      from: ymd('2026-11-05'),
      to: ymd('2026-11-05'),
    },
    {
      id: 'row-fee',
      articleId: FEE_ID,
      label: 'Faktureringsavgift nov -26',
      amount: 49,
      vat: 0,
      from: ymd('2026-11-01'),
      to: ymd('2026-11-30'),
    },
  ],
})

const leaseB = makeCachedLease({
  leaseId: '000-000-00-0001/01',
  status: LeaseStatus.Ended,
  contacts: [
    { name: 'Annan', contactCode: 'P243547', email: null, phone: null },
  ],
  rentRows: [
    {
      id: 'row-unknown',
      articleId: '',
      label: 'Utan artikel',
      amount: 10,
      vat: 0,
    },
  ],
})

describe(toRentRowListItems, () => {
  // Arrange and Act shared by the tests below
  const items = toRentRowListItems(
    [leaseA, leaseB],
    articles,
    HOME_INSURANCE_ID
  )

  it('returns one item per rent row, leases sorted by lease id', () => {
    // Assert
    expect(items.map((i) => i.rowId)).toEqual([
      'row-unknown',
      'row-ins',
      'row-fee',
    ])
  })

  it('looks up article code and timestamps', () => {
    // Act
    const ins = items.find((i) => i.rowId === 'row-ins')

    // Assert
    expect(ins).toMatchObject({
      leaseId: '000-000-00-0102/01',
      contactCodes: ['P0182914'],
      articleCode: 'HEMFÖR',
      isHomeInsurance: true,
      from: '2026-11-05',
      to: '2026-11-05',
      articleCreatedAt: '2026-11-03T21:33:37.593Z',
      articleUpdatedAt: '2026-11-04T08:00:00.000Z',
    })
  })

  it('leaves article fields null when the row has no known article', () => {
    // Assert
    expect(items.find((i) => i.rowId === 'row-unknown')).toMatchObject({
      articleId: null,
      articleCode: null,
      isHomeInsurance: false,
      from: null,
      to: null,
      articleCreatedAt: null,
    })
  })

  it('validates against the shared list item schema', () => {
    // Assert
    for (const item of items) {
      expect(() =>
        leasing.v1.LeaseRentRowListItemSchema.parse(item)
      ).not.toThrow()
    }
  })
})

describe(filterRentRowListItems, () => {
  // Arrange shared by the tests below; each expect runs the filter (Act)
  const items = toRentRowListItems(
    [leaseA, leaseB],
    articles,
    HOME_INSURANCE_ID
  )
  const ids = (params: Parameters<typeof filterRentRowListItems>[1]) =>
    filterRentRowListItems(items, params).map((i) => i.rowId)

  it('returns everything without params', () => {
    // Assert
    expect(ids({})).toHaveLength(3)
  })

  it('filters on lease status', () => {
    // Assert
    expect(ids({ status: ['current'] })).toEqual(['row-ins', 'row-fee'])
    expect(ids({ status: ['ended'] })).toEqual(['row-unknown'])
  })

  it('searches lease id, contact code, article code, label and row id, ignoring case', () => {
    // Assert
    expect(ids({ q: '0102/01' })).toEqual(['row-ins', 'row-fee'])
    expect(ids({ q: 'p243547' })).toEqual(['row-unknown'])
    expect(ids({ q: 'hemför' })).toEqual(['row-ins'])
    expect(ids({ q: 'faktureringsavgift' })).toEqual(['row-fee'])
    expect(ids({ q: 'row-fee' })).toEqual(['row-fee'])
  })

  it('filters home insurance rows and same-date rows', () => {
    // Assert
    expect(ids({ filter: 'homeInsurance' })).toEqual(['row-ins'])
    expect(ids({ filter: 'sameDate' })).toEqual(['row-ins'])
  })
})

describe(planHomeInsuranceEndDate, () => {
  const insuranceRow = factory.tenfastInvoiceRow.build({
    _id: 'row-ins',
    article: HOME_INSURANCE_ID,
    label: 'Mimers hemförsäkring',
    amount: 92,
    vat: 0,
    from: ymd('2026-11-05'),
    to: null,
  })
  const feeRow = factory.tenfastInvoiceRow.build({
    _id: 'row-fee',
    article: FEE_ID,
  })
  const lease = factory.tenfastLease.build({ hyror: [insuranceRow, feeRow] })

  it('replaces the row with an identical one with the new end date', () => {
    // Act
    const result = planHomeInsuranceEndDate(
      lease,
      { rowId: 'row-ins', endDate: '2026-12-31' },
      HOME_INSURANCE_ID
    )

    // Assert
    expect(result).toEqual({
      ok: true,
      plan: {
        rowsToDelete: ['row-ins'],
        rowsToAdd: [
          {
            amount: 92,
            vat: 0,
            article: HOME_INSURANCE_ID,
            label: 'Mimers hemförsäkring',
            from: '2026-11-05',
            to: '2026-12-31',
          },
        ],
      },
    })
  })

  it('refuses rows that are not home insurance', () => {
    // Assert
    expect(
      planHomeInsuranceEndDate(
        lease,
        { rowId: 'row-fee', endDate: '2026-12-31' },
        HOME_INSURANCE_ID
      )
    ).toEqual({ ok: false, err: 'not-home-insurance' })
  })

  it('refuses unknown rows', () => {
    // Assert
    expect(
      planHomeInsuranceEndDate(
        lease,
        { rowId: 'nope', endDate: '2026-12-31' },
        HOME_INSURANCE_ID
      )
    ).toEqual({ ok: false, err: 'row-not-found' })
  })

  it('refuses an end date before the start date', () => {
    // Assert
    expect(
      planHomeInsuranceEndDate(
        lease,
        { rowId: 'row-ins', endDate: '2026-11-04' },
        HOME_INSURANCE_ID
      )
    ).toEqual({ ok: false, err: 'end-before-start' })
  })

  it('refuses a change to the same end date', () => {
    // Arrange
    const ended = factory.tenfastLease.build({
      hyror: [{ ...insuranceRow, to: ymd('2026-12-31') }],
    })

    // Assert
    expect(
      planHomeInsuranceEndDate(
        ended,
        { rowId: 'row-ins', endDate: '2026-12-31' },
        HOME_INSURANCE_ID
      )
    ).toEqual({ ok: false, err: 'unchanged' })
  })
})
