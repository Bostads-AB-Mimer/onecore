import * as factory from './factories'
import { mapLeasesToLfExportRows } from '../services/lf-export'
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

  describe('field mapping', () => {
    it('maps lease and tenant fields correctly', () => {
      const tenant = factory.tenfastTenant.build({
        idbeteckning: '199001011234',
        name: { first: 'Anna', last: 'Svensson' },
        postadress: 'Storgatan 1',
        phone: '0701234567',
        invoiceEmail: null,
      })
      const rentalObject = factory.tenfastRentalObject.build({
        externalId: 'RO-001',
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
        address: 'Storgatan 1',
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
  })
})
