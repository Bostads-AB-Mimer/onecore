import { leasing, LeaseStatus } from '@onecore/types'

import {
  TenfastInvoiceRow,
  YearMonthDayStringSchema,
} from '../adapters/tenfast/schemas'
import {
  filterHomeInsuranceItems,
  homeInsuranceListLinkParams,
  listHomeInsuranceItems,
  mapHomeInsuranceRows,
  sortHomeInsuranceItems,
} from '../services/home-insurance-list'
import * as factory from './factories'

const ARTICLE_ID = 'home-insurance-article-id'
const TODAY = '2026-11-13'

const day = (value: string) => YearMonthDayStringSchema.parse(value)

const insuranceRow = (overrides: Partial<TenfastInvoiceRow> = {}) =>
  factory.tenfastInvoiceRow.build({
    article: ARTICLE_ID,
    label: 'Hemförsäkring',
    amount: 93,
    vat: 0,
    from: day('2024-01-01'),
    to: null,
    ...overrides,
  })

const item = (
  overrides: Partial<leasing.HomeInsuranceListItem> = {}
): leasing.HomeInsuranceListItem => ({
  leaseId: 'L1',
  leaseStatus: 'G',
  leaseStage: LeaseStatus.Current,
  leaseFromDate: '2024-01-01',
  leaseToDate: null,
  rentalObjectCode: '123-456-78-0101',
  numberOfRooms: 2,
  squareMeters: 50,
  address: 'Testgatan 1',
  postalCode: '72211',
  city: 'Västerås',
  rowId: 'row-1',
  rowFromDate: '2024-01-01',
  rowToDate: null,
  monthlyAmount: 93,
  articleText: 'Hemförsäkring',
  contactCode: 'P000001',
  isCompany: false,
  ...overrides,
})

const query = (
  input: leasing.HomeInsuranceListQueryParamsInput = {}
): leasing.HomeInsuranceListQueryParams =>
  leasing.HomeInsuranceListQueryParamsSchema.parse(input)

describe(mapHomeInsuranceRows, () => {
  it('lists every home insurance row, including the ones the LF file leaves out', () => {
    const company = factory.tenfastTenant.build({
      externalId: 'F000001',
      isCompany: true,
      idbeteckning: '5560000000',
    })
    const lease = factory.tenfastLease.build({
      externalId: 'L1',
      stage: 'active',
      hyresgaster: [company],
      hyror: [
        insuranceRow({
          _id: 'ended',
          from: day('2020-01-01'),
          to: day('2020-12-31'),
        }),
        insuranceRow({ _id: 'negative', amount: -93 }),
        insuranceRow({ _id: 'no-from', from: null }),
        factory.tenfastInvoiceRow.build({ _id: 'rent', article: 'rent' }),
      ],
    })

    const items = mapHomeInsuranceRows([lease], ARTICLE_ID)

    expect(items.map((i) => i.rowId)).toEqual(['ended', 'negative', 'no-from'])
    expect(items[0]).toMatchObject({
      leaseStatus: '*',
      rowToDate: '2020-12-31',
    })
    expect(items[1]).toMatchObject({ leaseStatus: 'G', monthlyAmount: -93 })
    expect(items[2]).toMatchObject({ rowFromDate: null })
    expect(items.every((i) => i.contactCode === 'F000001' && i.isCompany)).toBe(
      true
    )
  })
})

describe(filterHomeInsuranceItems, () => {
  const items = [
    item({
      rowId: 'a',
      address: 'Ängsvägen 2',
      contactCode: 'P000001',
    }),
    item({
      rowId: 'b',
      address: 'Storgatan 5',
      contactCode: 'P000002',
      rowFromDate: '2026-12-01',
      rowToDate: '2026-12-01',
    }),
    item({
      rowId: 'c',
      address: null,
      contactCode: null,
      rowFromDate: null,
      rowToDate: null,
    }),
  ]
  const rowIds = (filtered: leasing.HomeInsuranceListItem[]) =>
    filtered.map((i) => i.rowId)

  it('matches q against the address, ignoring case', () => {
    expect(rowIds(filterHomeInsuranceItems(items, { q: 'ängsväg' }))).toEqual([
      'a',
    ])
  })

  it('keeps only the given contact codes, trimmed and ignoring case', () => {
    expect(
      rowIds(
        filterHomeInsuranceItems(items, { contactCodes: [' p000001 ', 'X'] })
      )
    ).toEqual(['a'])
  })

  it('matches nothing for an empty list of contact codes', () => {
    expect(filterHomeInsuranceItems(items, { contactCodes: [] })).toEqual([])
  })

  it('keeps only rows whose first and last day are the same with sameDate', () => {
    expect(rowIds(filterHomeInsuranceItems(items, { sameDate: true }))).toEqual(
      ['b']
    )
  })
})

describe(sortHomeInsuranceItems, () => {
  it('sorts addresses in Swedish order, empty values last', () => {
    const items = [
      item({ rowId: '1', address: 'Ängsvägen 1' }),
      item({ rowId: '2', address: null }),
      item({ rowId: '3', address: 'Zetagatan 1' }),
      item({ rowId: '4', address: 'Åsgatan 1' }),
      item({ rowId: '5', address: 'Andgatan 1' }),
    ]

    const ascending = sortHomeInsuranceItems(items, 'address', 'asc')
    const descending = sortHomeInsuranceItems(items, 'address', 'desc')

    expect(ascending.map((i) => i.address)).toEqual([
      'Andgatan 1',
      'Zetagatan 1',
      'Åsgatan 1',
      'Ängsvägen 1',
      null,
    ])
    expect(descending.map((i) => i.address)).toEqual([
      'Ängsvägen 1',
      'Åsgatan 1',
      'Zetagatan 1',
      'Andgatan 1',
      null,
    ])
  })

  it('breaks ties by leaseId and rowId in both directions', () => {
    const items = [
      item({ leaseId: 'L2', rowId: 'b' }),
      item({ leaseId: 'L1', rowId: 'b' }),
      item({ leaseId: 'L1', rowId: 'a' }),
    ]

    const order = (sortOrder: 'asc' | 'desc') =>
      sortHomeInsuranceItems(items, 'leaseStatus', sortOrder).map(
        (i) => `${i.leaseId}/${i.rowId}`
      )

    expect(order('asc')).toEqual(['L1/a', 'L1/b', 'L2/b'])
    expect(order('desc')).toEqual(['L1/a', 'L1/b', 'L2/b'])
  })
})

describe(listHomeInsuranceItems, () => {
  const leases = ['C', 'A', 'B', 'E', 'D'].map((id) =>
    factory.tenfastLease.build({
      externalId: id,
      stage: 'active',
      hyresgaster: [factory.tenfastTenant.build({ externalId: `P-${id}` })],
      hyror: [insuranceRow({ _id: `row-${id}` })],
    })
  )

  it('pages the sorted items and counts every match', () => {
    const page = (p: number) =>
      listHomeInsuranceItems(
        leases,
        ARTICLE_ID,
        query({ page: p, limit: 2 }),
        TODAY
      )

    expect(page(1)).toMatchObject({ totalRecords: 5 })
    expect(page(1).content.map((i) => i.leaseId)).toEqual(['A', 'B'])
    expect(page(2).content.map((i) => i.leaseId)).toEqual(['C', 'D'])
    expect(page(3).content.map((i) => i.leaseId)).toEqual(['E'])
    expect(page(4).content).toEqual([])
  })

  it('lists the LF selection with rows=lf and every row with rows=all', () => {
    const withCompany = [
      ...leases,
      factory.tenfastLease.build({
        externalId: 'F',
        hyresgaster: [factory.tenfastTenant.build({ isCompany: true })],
        hyror: [insuranceRow()],
      }),
    ]

    const lf = listHomeInsuranceItems(
      withCompany,
      ARTICLE_ID,
      query({ rows: 'lf' }),
      TODAY
    )
    const all = listHomeInsuranceItems(
      withCompany,
      ARTICLE_ID,
      query({ rows: 'all' }),
      TODAY
    )

    expect(lf.totalRecords).toBe(5)
    expect(all.totalRecords).toBe(6)
  })
})

describe('HomeInsuranceListQueryParamsSchema', () => {
  it('reads lists given once, repeated or comma-separated', () => {
    expect(
      query({ contactCodes: ['P1,P2', ' P3 '], status: 'G,*' })
    ).toMatchObject({ contactCodes: ['P1', 'P2', 'P3'], status: ['G', '*'] })
  })

  it('reads an empty contactCodes as an empty list', () => {
    expect(query({ contactCodes: '' }).contactCodes).toEqual([])
  })

  it('reads sameDate from a query string', () => {
    expect(query({ sameDate: 'true' }).sameDate).toBe(true)
    expect(query({ sameDate: 'false' }).sameDate).toBe(false)
  })
})

describe(homeInsuranceListLinkParams, () => {
  it('keeps the filters and sort order, not page and limit', () => {
    expect(
      homeInsuranceListLinkParams(
        query({
          q: 'gatan',
          contactCodes: 'P1,P2',
          status: ['G', 'K'],
          rows: 'all',
          sameDate: 'true',
          sortBy: 'address',
          sortOrder: 'desc',
          page: 2,
          limit: 10,
        })
      )
    ).toEqual({
      q: 'gatan',
      contactCodes: 'P1,P2',
      status: 'G,K',
      rows: 'all',
      sameDate: 'true',
      sortBy: 'address',
      sortOrder: 'desc',
    })
  })
})
