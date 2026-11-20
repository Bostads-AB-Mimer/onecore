import { LeaseStatus } from '@onecore/types'
import * as factory from './factories'
import {
  mapLeasesToLfExportRows,
  mapLeasesToLfListItems,
} from '../services/lf-export'
import { toYearMonthDayString } from '../adapters/tenfast/schemas'

const ARTICLE_ID = 'home-insurance-article-id'

const makeInsuranceRow = (overrides = {}) =>
  factory.tenfastInvoiceRow.build({
    article: ARTICLE_ID,
    label: 'Mimers Hemförsäkring',
    amount: 1200,
    from: toYearMonthDayString(new Date('2024-01-01')),
    to: null,
    ...overrides,
  })

const makeLease = (overrides = {}) =>
  factory.tenfastLease.build({
    stage: 'active',
    hyror: [makeInsuranceRow()],
    hyresgaster: [factory.tenfastTenant.build()],
    hyresobjekt: [factory.tenfastRentalObject.build()],
    ...overrides,
  })

describe(mapLeasesToLfExportRows, () => {
  describe('status derivation', () => {
    it('returns G for active lease with no to-date on insurance row', () => {
      const rows = mapLeasesToLfExportRows([makeLease()], ARTICLE_ID)

      expect(rows).toHaveLength(1)
      expect(rows[0].leaseStatus).toBe('G')
    })

    it('returns K for upcoming lease with no to-date on insurance row', () => {
      const rows = mapLeasesToLfExportRows(
        [makeLease({ stage: 'upcoming' })],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].leaseStatus).toBe('K')
    })

    it('returns * when insurance row has a to-date', () => {
      const rows = mapLeasesToLfExportRows(
        [
          makeLease({
            hyror: [
              makeInsuranceRow({
                to: toYearMonthDayString(new Date('2025-06-01')),
              }),
            ],
          }),
        ],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].leaseStatus).toBe('*')
    })

    it('returns * for preTermination lease when insurance row has a to-date', () => {
      const rows = mapLeasesToLfExportRows(
        [
          makeLease({
            stage: 'preTermination',
            hyror: [
              makeInsuranceRow({
                to: toYearMonthDayString(new Date('2025-06-01')),
              }),
            ],
          }),
        ],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].leaseStatus).toBe('*')
    })
  })

  describe('filtering', () => {
    it('excludes leases where no tenant has idbeteckning', () => {
      const rows = mapLeasesToLfExportRows(
        [
          makeLease({
            hyresgaster: [factory.tenfastTenant.build({ idbeteckning: null })],
          }),
        ],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(0)
    })

    it('excludes leases with only company tenants', () => {
      const rows = mapLeasesToLfExportRows(
        [
          makeLease({
            hyresgaster: [factory.tenfastTenant.build({ isCompany: true })],
          }),
        ],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(0)
    })

    it('excludes leases where insurance row has no from-date', () => {
      const rows = mapLeasesToLfExportRows(
        [
          makeLease({
            hyror: [makeInsuranceRow({ from: null })],
          }),
        ],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(0)
    })

    it('excludes leases with no matching insurance row', () => {
      const rows = mapLeasesToLfExportRows(
        [
          makeLease({
            hyror: [
              factory.tenfastInvoiceRow.build({ article: 'other-article' }),
            ],
          }),
        ],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(0)
    })

    it('excludes leases where insurance row has a negative amount', () => {
      const rows = mapLeasesToLfExportRows(
        [makeLease({ hyror: [makeInsuranceRow({ amount: -93 })] })],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(0)
    })

    it('excludes leases with no rental object', () => {
      const rows = mapLeasesToLfExportRows(
        [makeLease({ hyresobjekt: [] })],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(0)
    })

    it('uses the non-company tenant when both a company and person tenant exist', () => {
      const person = factory.tenfastTenant.build({
        isCompany: false,
        idbeteckning: '199001011234',
      })
      const company = factory.tenfastTenant.build({ isCompany: true })

      const rows = mapLeasesToLfExportRows(
        [makeLease({ hyresgaster: [company, person] })],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].nationalIdNumber).toBe('199001011234')
    })
  })

  describe('row selection', () => {
    const ended = makeInsuranceRow({
      _id: 'ended',
      amount: 80,
      from: toYearMonthDayString(new Date('2020-01-01')),
      to: toYearMonthDayString(new Date('2020-12-31')),
    })
    const current = makeInsuranceRow({
      _id: 'current',
      amount: 93,
      from: toYearMonthDayString(new Date('2021-01-01')),
      to: null,
    })

    it('exports the row in force, not an ended row listed before it', () => {
      const rows = mapLeasesToLfExportRows(
        [makeLease({ hyror: [ended, current] })],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ leaseStatus: 'G', annualRent: 93 })
      expect(rows[0].rowToDate).toBeNull()
    })
  })

  describe('field mapping', () => {
    it('maps lease and tenant fields correctly', () => {
      const tenant = factory.tenfastTenant.build({
        idbeteckning: '199001011234',
        name: { first: 'Anna', last: 'Svensson' },
        postadress: 'Tenant invoice street 99',
        postnummer: '11111',
        stad: 'Göteborg',
        phone: '0701234567',
        invoiceEmail: null,
      })
      const rentalObject = factory.tenfastRentalObject.build({
        externalId: 'RO-001',
        postadress: 'Ibbarbo 6',
        postnummer: '73113',
        stad: 'KOLSVA',
        roomCount: 3,
        kvm: 75,
      })
      const lease = factory.tenfastLease.build({
        externalId: 'LEASE-001',
        startDate: new Date('2023-01-01'),
        endDate: null,
        stage: 'active',
        hyror: [makeInsuranceRow({ amount: 2400 })],
        hyresgaster: [tenant],
        hyresobjekt: [rentalObject],
      })

      const rows = mapLeasesToLfExportRows([lease], ARTICLE_ID)

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        leaseId: 'LEASE-001',
        nationalIdNumber: '199001011234',
        fullName: 'Svensson Anna',
        address: 'Ibbarbo 6',
        postalCode: '73113',
        city: 'KOLSVA',
        phoneNumber: '0701234567',
        email: null,
        rentalObjectCode: 'RO-001',
        numberOfRooms: 3,
        squareMeters: 75,
        annualRent: 2400,
        articleText: 'Mimers Hemförsäkring',
        leaseToDate: null,
      })
    })

    it('rounds square meters to the nearest integer', () => {
      const rows = mapLeasesToLfExportRows(
        [
          makeLease({
            hyresobjekt: [factory.tenfastRentalObject.build({ kvm: 75.7 })],
          }),
        ],
        ARTICLE_ID
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].squareMeters).toBe(76)
    })
  })
})

describe(mapLeasesToLfListItems, () => {
  it('lists the same leases as the file, in the same order', () => {
    const leases = [
      makeLease({ externalId: 'L1' }),
      makeLease({
        externalId: 'L2',
        hyresgaster: [factory.tenfastTenant.build({ isCompany: true })],
      }),
      makeLease({
        externalId: 'L3',
        hyror: [makeInsuranceRow({ amount: -93 })],
      }),
      makeLease({ externalId: 'L4', stage: 'upcoming' }),
    ]

    const items = mapLeasesToLfListItems(leases, ARTICLE_ID, '2026-11-13')
    const rows = mapLeasesToLfExportRows(leases, ARTICLE_ID)

    expect(items.map((item) => [item.leaseId, item.leaseStatus])).toEqual(
      rows.map((row) => [row.leaseId, row.leaseStatus])
    )
  })

  it('carries rowId, leaseStage and contactCode and no person data', () => {
    const tenant = factory.tenfastTenant.build({
      externalId: 'P123456',
      idbeteckning: '199001011234',
      name: { first: 'Anna', last: 'Svensson' },
      phone: '0701234567',
      invoiceEmail: 'anna@example.com',
    })
    const lease = factory.tenfastLease.build({
      externalId: 'LEASE-001',
      startDate: new Date('2022-12-31T23:00:00Z'),
      endDate: null,
      stage: 'upcoming',
      hyror: [makeInsuranceRow({ _id: 'row-1', amount: 93 })],
      hyresgaster: [tenant],
      hyresobjekt: [
        factory.tenfastRentalObject.build({
          externalId: 'RO-001',
          postadress: 'Ibbarbo 6',
          roomCount: 3,
          kvm: 75.4,
        }),
      ],
    })

    const [item] = mapLeasesToLfListItems([lease], ARTICLE_ID, '2026-11-13')

    expect(item).toEqual({
      leaseId: 'LEASE-001',
      leaseStatus: 'K',
      leaseStage: LeaseStatus.Upcoming,
      // A Swedish day: midnight in Stockholm, the day before in UTC.
      leaseFromDate: '2023-01-01',
      leaseToDate: null,
      rentalObjectCode: 'RO-001',
      numberOfRooms: 3,
      squareMeters: 75,
      address: 'Ibbarbo 6',
      postalCode: '73113',
      city: 'KOLSVA',
      rowId: 'row-1',
      rowFromDate: '2024-01-01',
      rowToDate: null,
      monthlyAmount: 93,
      articleText: 'Mimers Hemförsäkring',
      contactCode: 'P123456',
      isCompany: false,
    })
    const serialized = JSON.stringify(item)
    expect(serialized).not.toContain('199001011234')
    expect(serialized).not.toContain('Svensson')
    expect(serialized).not.toContain('0701234567')
    expect(serialized).not.toContain('anna@example.com')
  })
})
