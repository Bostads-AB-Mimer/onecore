jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')
  return {
    ...actual,
    // createExcelExport lazy-loads exceljs via a dynamic import, which
    // requires --experimental-vm-modules under Jest's CJS transform.
    // Route tests only need to assert on status/params, not real xlsx bytes.
    // Configured per-test since beforeEach(jest.resetAllMocks) clears this.
    createExcelExport: jest.fn(),
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
      warn: () => {
        return
      },
      debug: () => {
        return
      },
    },
    generateRouteMetadata: jest.fn(),
    makeSuccessResponseBody: <T>(content: T, metadata: object) => ({
      content,
      ...metadata,
    }),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import {
  Contact,
  Lease,
  leasing,
  schemas,
  LeaseStatus,
  LeaseType,
} from '@onecore/types'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as leasesAdapter from '../../../adapters/leasing-adapter/leases'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import { contactsAdapter } from '../../../adapters/contacts-adapter'
import * as factory from '../../../../test/factories'
import { Lease as LeaseSchema } from '../schemas/lease'
import * as utilities from '@onecore/utilities'
import { PaginatedResponse } from '@onecore/utilities'
import { requireRole } from '../../../middlewares/keycloak-auth'
import { requiredRolesFor } from '../../../middlewares/route-roles'

const buildHomeInsuranceListItem = (
  overrides: Partial<leasing.HomeInsuranceListItem> = {}
): leasing.HomeInsuranceListItem => ({
  leaseId: '705-001-01-0101/1',
  leaseStatus: 'G',
  leaseStage: LeaseStatus.Current,
  leaseFromDate: '2024-01-01',
  leaseToDate: null,
  rentalObjectCode: '705-001-01-0101',
  numberOfRooms: 2,
  squareMeters: 55,
  address: 'Testgatan 1',
  postalCode: '72216',
  city: 'Västerås',
  rowId: 'row-1',
  rowFromDate: '2024-01-01',
  rowToDate: null,
  monthlyAmount: 80,
  articleText: 'Hemförsäkring',
  contactCode: 'P158770',
  isCompany: false,
  ...overrides,
})

const buildPaginatedResponse = <T>(
  content: T[] = []
): PaginatedResponse<T> => ({
  content,
  _meta: {
    totalRecords: content.length,
    page: 1,
    limit: 500,
    count: content.length,
  },
  _links: [],
})

const buildLeaseSearchResult = (
  overrides: Partial<leasing.v1.LeaseSearchResult> = {}
): leasing.v1.LeaseSearchResult => ({
  leaseId: '705-001-01-0101/1',
  objectTypeCode: 'Bostad',
  leaseType: LeaseType.HousingContract,
  contacts: [
    { contactCode: 'P158770', name: 'Test Testsson', email: null, phone: null },
  ],
  address: 'Testgatan 1',
  postalCode: '72216',
  city: 'Västerås',
  startDate: new Date('2024-01-01'),
  endDate: null,
  lastDebitDate: null,
  signedAt: null,
  status: LeaseStatus.Current,
  rentalObjectCode: '705-001-01-0101',
  ...overrides,
})

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('leases routes', () => {
  const leaseMock: Lease = factory.lease.build()

  describe('GET /leases/by-rental-object-code/:rentalObjectCode', () => {
    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123?status=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByRentalObjectCode')
        .mockRejectedValue(new Error('Adapter error'))

      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123'
      )

      expect(res.status).toBe(500)
    })

    it('responds with a list of leases for valid query parameters', async () => {
      const getLeasesByRentalObjectCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByRentalObjectCode')
        .mockResolvedValue(factory.lease.buildList(1))

      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123?status=current'
      )

      expect(res.status).toBe(200)
      expect(getLeasesByRentalObjectCodeSpy).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          status: ['current'],
        })
      )

      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
    })

    it('responds with 500 when leasing returns leases that do not match the schema', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByRentalObjectCode')
        .mockResolvedValue([factory.lease.build({ leaseId: 123 as never })])

      const res = await request(app.callback()).get(
        '/leases/by-rental-object-code/123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Invalid lease data' })
    })
  })

  describe('GET /leases/by-contact-code/:contactCode', () => {
    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123?includeContacts=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 400 for invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123?status=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        reason: 'Invalid query parameters',
        error: expect.any(Object),
      })
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockRejectedValue(new Error('Adapter error'))

      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123'
      )

      expect(res.status).toBe(500)
    })

    it('responds with a list of leases for valid query parameters', async () => {
      const tenant = factory.contactsServiceContact.build()
      jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({ ok: true, data: [tenant] })

      const getLeasesByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockResolvedValue([
          { ...leaseMock, tenantContactIds: [tenant.contactCode] },
        ])

      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123?status=current,upcoming,about-to-end&includeContacts=true'
      )

      expect(res.status).toBe(200)
      expect(getLeasesByContactCodeSpy).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          status: ['current', 'upcoming', 'about-to-end'],
          includeContacts: true,
        })
      )

      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
    })

    it('responds with 500 when leasing returns leases that do not match the schema', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockResolvedValue([factory.lease.build({ leaseId: 123 as never })])

      const res = await request(app.callback()).get(
        '/leases/by-contact-code/123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Invalid lease data' })
    })

    it('passes includeSubletLeases on to leasing', async () => {
      const { contactCode } = factory.contact.build()
      const getLeasesByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockResolvedValue([])

      const res = await request(app.callback()).get(
        `/leases/by-contact-code/${contactCode}?includeSubletLeases=true`
      )

      expect(res.status).toBe(200)
      expect(getLeasesByContactCodeSpy).toHaveBeenCalledWith(
        contactCode,
        expect.objectContaining({ includeSubletLeases: true })
      )
    })

    describe('with a sublet tenant', () => {
      const firstHand = factory.contactsServiceContact.build()
      const sublet = factory.contactsServiceContact.build()
      const subletLease = factory.lease.build({
        tenantContactIds: [firstHand.contactCode],
        subletContactId: sublet.contactCode,
      })
      const url = `/leases/by-contact-code/${sublet.contactCode}?includeContacts=true`

      beforeEach(() => {
        jest
          .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
          .mockResolvedValue([subletLease])
      })

      it('adds the sublet contact tagged as subletTenant', async () => {
        const getContactsSpy = jest
          .spyOn(contactsAdapter, 'getByContactCodeBatch')
          .mockResolvedValue({ ok: true, data: [firstHand, sublet] })

        const res = await request(app.callback()).get(url)

        expect(res.status).toBe(200)
        expect(getContactsSpy).toHaveBeenCalledTimes(1)
        expect(getContactsSpy).toHaveBeenCalledWith(
          [firstHand.contactCode, sublet.contactCode],
          { includePhone: true, includeEmail: true, includeAddress: true }
        )
        expect(res.body.content[0].tenants).toEqual([
          expect.objectContaining({
            contactCode: firstHand.contactCode,
            isTenant: true,
          }),
          expect.objectContaining({
            contactCode: sublet.contactCode,
            leaseContactType: 'subletTenant',
            isTenant: false,
          }),
        ])
      })

      it('returns the lease without the sublet contact when that contact does not exist', async () => {
        jest
          .spyOn(contactsAdapter, 'getByContactCodeBatch')
          .mockResolvedValue({ ok: true, data: [firstHand] })

        const res = await request(app.callback()).get(url)

        expect(res.status).toBe(200)
        expect(res.body.content[0].tenants).toEqual([
          expect.objectContaining({ contactCode: firstHand.contactCode }),
        ])
        expect(res.body.content[0].subletContactId).toBe(sublet.contactCode)
      })

      it('fails when the contact lookup fails', async () => {
        jest
          .spyOn(contactsAdapter, 'getByContactCodeBatch')
          .mockResolvedValue({ ok: false, err: 'unknown', statusCode: 500 })

        const res = await request(app.callback()).get(url)

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('unknown')
      })

      it('still fails when a first-hand tenant cannot be found', async () => {
        jest
          .spyOn(contactsAdapter, 'getByContactCodeBatch')
          .mockResolvedValue({ ok: true, data: [sublet] })

        const res = await request(app.callback()).get(url)

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('no-contact')
      })
    })

    describe('with a tenant with protected identity', () => {
      const redacted = factory.contactsServiceContact.build({
        protectedIdentity: true,
        personal: {
          nationalId: 'redacted',
          birthDate: 'redacted',
          firstName: 'redacted',
          lastName: 'redacted',
          fullName: 'redacted',
        },
        communication: {
          phoneNumbers: [],
          emailAddresses: [],
          specialAttention: false,
        },
        addresses: [],
      })
      const unredacted = factory.contactsServiceContact.build({
        contactCode: redacted.contactCode,
        protectedIdentity: true,
      })
      const lease = factory.lease.build({
        tenantContactIds: [redacted.contactCode],
      })
      const url = `/leases/by-contact-code/${redacted.contactCode}?includeContacts=true`

      beforeEach(() => {
        jest
          .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
          .mockResolvedValue([lease])
      })

      it('shows the tenant when Tenfast has a lease for them', async () => {
        jest
          .spyOn(leasesAdapter, 'getLeasesByContactCode')
          .mockResolvedValue([lease])
        const getContactsSpy = jest
          .spyOn(contactsAdapter, 'getByContactCodeBatch')
          .mockResolvedValueOnce({ ok: true, data: [redacted] })
          .mockResolvedValueOnce({ ok: true, data: [unredacted] })

        const res = await request(app.callback()).get(url)

        expect(res.status).toBe(200)
        expect(getContactsSpy).toHaveBeenLastCalledWith(
          [redacted.contactCode],
          expect.objectContaining({ verifiedTenants: true })
        )
        expect(res.body.content[0].tenants).toEqual([
          expect.objectContaining({
            contactCode: redacted.contactCode,
            fullName: unredacted.personal.fullName,
            protectedIdentity: true,
            protectedIdentityDetails: 'shown',
          }),
        ])
      })

      it('responds 200 with the tenant redacted when they are not a tenant in Tenfast', async () => {
        jest
          .spyOn(leasesAdapter, 'getLeasesByContactCode')
          .mockResolvedValue([])
        jest
          .spyOn(contactsAdapter, 'getByContactCodeBatch')
          .mockResolvedValue({ ok: true, data: [redacted] })

        const res = await request(app.callback()).get(url)

        expect(res.status).toBe(200)
        expect(res.body.content[0].tenants).toEqual([
          expect.objectContaining({
            contactCode: redacted.contactCode,
            firstName: null,
            lastName: null,
            fullName: null,
            nationalRegistrationNumber: '',
            birthDate: null,
            protectedIdentity: true,
            protectedIdentityDetails: 'withheld',
          }),
        ])
      })
    })
  })

  describe('GET /leases/by-pnr/:pnr', () => {
    it('responds with a list of leases', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getContactForPnr')
        .mockResolvedValue(factory.contact.build())
      const getLeasesSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get(
        '/leases/by-pnr/101010-1010'
      )
      expect(res.status).toBe(200)
      expect(getLeasesSpy).toHaveBeenCalled()
      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
    })

    it('responds with an empty list when the pnr matches no contact', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getContactForPnr')
        .mockResolvedValue(null as unknown as Contact)
      const getLeasesSpy = jest.spyOn(
        tenantLeaseAdapter,
        'getLeasesByContactCode'
      )

      const res = await request(app.callback()).get(
        '/leases/by-pnr/101010-1010'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
      expect(getLeasesSpy).not.toHaveBeenCalled()
    })

    it('responds with 500 when leasing returns leases that do not match the schema', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getContactForPnr')
        .mockResolvedValue(factory.contact.build())
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesByContactCode')
        .mockResolvedValue([factory.lease.build({ leaseId: 123 as never })])

      const res = await request(app.callback()).get(
        '/leases/by-pnr/101010-1010'
      )

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Invalid lease data' })
    })
  })

  describe('GET /leases/:id', () => {
    it('responds with lease', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const res = await request(app.callback()).get('/leases/1337')
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()
      expect(() => LeaseSchema.parse(res.body.content)).not.toThrow()
    })

    it('responds with lease with contacts', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue({ ...leaseMock, tenantContactIds: ['123'] })

      const getContactsSpy = jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({
          ok: true,
          data: [factory.contactsServiceContact.build({ contactCode: '123' })],
        })

      const res = await request(app.callback()).get(
        '/leases/1337?includeContacts=true'
      )
      expect(getContactsSpy).toHaveBeenCalledWith(['123'], expect.any(Object))
      expect(res.status).toBe(200)
      expect(res.body.content.tenants).toEqual([
        expect.objectContaining({ contactCode: '123' }),
      ])
      expect(() => LeaseSchema.parse(res.body.content)).not.toThrow()
    })

    it('responds with 500 when leasing returns a lease that does not match the schema', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(factory.lease.build({ leaseId: 123 as never }))

      const res = await request(app.callback()).get('/leases/1337')

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Invalid lease data' })
    })
  })

  describe('POST /leases/batch', () => {
    it('responds with 400 if leaseIds is missing', async () => {
      const res = await request(app.callback()).post('/leases/batch').send({})

      expect(res.status).toBe(400)
    })

    it('responds with 400 if leaseIds is an empty array', async () => {
      const res = await request(app.callback())
        .post('/leases/batch')
        .send({ leaseIds: [] })

      expect(res.status).toBe(400)
    })

    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeasesBatch')
        .mockRejectedValue(new Error('Adapter error'))

      const res = await request(app.callback())
        .post('/leases/batch')
        .send({ leaseIds: ['1337'] })

      expect(res.status).toBe(500)
    })

    it('responds with 200 and the leases for the given ids', async () => {
      const getLeasesBatchSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesBatch')
        .mockResolvedValue(factory.lease.buildList(2))

      const res = await request(app.callback())
        .post('/leases/batch')
        .send({ leaseIds: ['1337', '1338'] })

      expect(res.status).toBe(200)
      expect(getLeasesBatchSpy).toHaveBeenCalledWith(['1337', '1338'])
      expect(() => LeaseSchema.array().parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /leases/:leaseId/home-insurance', () => {
    it.each([
      ['lease-not-found', 404],
      ['upstream-failed', 503],
      ['unknown', 500],
    ] as const)('answers %s with %i', async (err, status) => {
      const getHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeaseHomeInsurance')
        .mockResolvedValue({ ok: false, err })

      const res = await request(app.callback()).get(
        '/leases/1337/home-insurance'
      )

      expect(res.status).toBe(status)
      expect(res.body.error).toBe(err)
      expect(getHomeInsuranceSpy).toHaveBeenCalledWith('1337')
    })

    it('responds with home insurance and its rowId', async () => {
      const responsePayload = {
        rowId: 'row-1',
        monthlyAmount: 123,
        from: '2024-01-01',
        to: '2024-12-31',
      }
      const getHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeaseHomeInsurance')
        .mockResolvedValue({ ok: true, data: responsePayload })

      const res = await request(app.callback()).get(
        '/leases/1337/home-insurance'
      )

      expect(res.status).toBe(200)
      expect(getHomeInsuranceSpy).toHaveBeenCalledWith('1337')
      expect(res.body.content).toEqual(responsePayload)
      // Mina sidor reads it with the old schema.
      expect(() =>
        schemas.v1.LeaseHomeInsuranceSchema.parse(res.body.content)
      ).not.toThrow()
    })
  })

  describe('GET /leases/:leaseId/home-insurance/offer', () => {
    it('responds with home insurance offer', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: factory.residenceByRentalIdDetails.build({
            type: {
              roomCount: 1,
            },
          }),
        })

      const res = await request(app.callback()).get(
        '/leases/1337/home-insurance/offer'
      )

      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalledWith('1337')
      expect(() =>
        schemas.v1.LeaseHomeInsuranceOfferSchema.parse(res.body.content)
      ).not.toThrow()
    })
  })

  describe('POST /leases/:leaseId/home-insurance', () => {
    it('returns 500 when adapter returns error', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValueOnce(leaseMock)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.residenceByRentalIdDetails.build({
            type: {
              roomCount: 1,
            },
          }),
        })

      const addHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'addLeaseHomeInsurance')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/leases/1337/home-insurance')
        .send({ from: new Date('2024-01-01') })

      expect(res.status).toBe(500)
      expect(addHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
        from: expect.any(Date),
        monthlyAmount: 69,
      })
    })

    it('adds home insurance rent row', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValueOnce(leaseMock)

      const addHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'addLeaseHomeInsurance')
        .mockResolvedValueOnce({
          ok: true,
          data: null,
        })

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.residenceByRentalIdDetails.build({
            type: {
              roomCount: 1,
            },
          }),
        })

      const res = await request(app.callback())
        .post('/leases/1337/home-insurance')
        .send({ from: new Date('2024-01-01') })

      expect(res.status).toBe(200)
      expect(addHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
        from: expect.any(Date),
        monthlyAmount: 69,
      })
      expect(res.body.content).toEqual(null)
    })
  })

  describe('POST /leases/:leaseId/home-insurance/cancel', () => {
    it.each([
      ['lease-not-found', 404],
      ['invalid-request', 400],
      ['upstream-failed', 503],
      ['unknown', 500],
    ] as const)(
      "passes leasing's %s on as %i, without checks of its own",
      async (err, status) => {
        const getLeaseSpy = jest.spyOn(tenantLeaseAdapter, 'getLease')
        const getHomeInsuranceSpy = jest.spyOn(
          tenantLeaseAdapter,
          'getLeaseHomeInsurance'
        )
        const cancelHomeInsuranceSpy = jest
          .spyOn(tenantLeaseAdapter, 'cancelLeaseHomeInsurance')
          .mockResolvedValue({ ok: false, err })

        const res = await request(app.callback())
          .post('/leases/1337/home-insurance/cancel')
          .send({ endDate: new Date('2024-10-01') })

        expect(res.status).toBe(status)
        expect(res.body.error).toBe(err)
        expect(cancelHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
          endDate: expect.any(Date),
        })
        expect(getLeaseSpy).not.toHaveBeenCalled()
        expect(getHomeInsuranceSpy).not.toHaveBeenCalled()
      }
    )

    it('cancels home insurance', async () => {
      const cancelHomeInsuranceSpy = jest
        .spyOn(tenantLeaseAdapter, 'cancelLeaseHomeInsurance')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback())
        .post('/leases/1337/home-insurance/cancel')
        .send({ endDate: new Date('2024-10-01') })

      expect(res.status).toBe(200)
      expect(cancelHomeInsuranceSpy).toHaveBeenCalledWith('1337', {
        endDate: expect.any(Date),
      })
      expect(res.body.content).toBeNull()
    })
  })

  describe('GET /leases/home-insurances', () => {
    const listPage = (
      items: leasing.HomeInsuranceListItem[],
      totalRecords = items.length
    ) => ({
      ok: true as const,
      data: {
        content: items,
        _meta: {
          totalRecords,
          page: 1,
          limit: 50,
          count: items.length,
        },
        _links: [],
      },
    })

    it('lists rows with the person fields from the contacts service', async () => {
      const getLeaseSpy = jest.spyOn(tenantLeaseAdapter, 'getLease')
      const listSpy = jest
        .spyOn(tenantLeaseAdapter, 'listHomeInsurances')
        .mockResolvedValue(listPage([buildHomeInsuranceListItem()], 120))
      jest.spyOn(contactsAdapter, 'getByContactCodeBatch').mockResolvedValue({
        ok: true,
        data: [factory.domainContact.build({ contactCode: 'P158770' })],
      })

      const res = await request(app.callback()).get(
        '/leases/home-insurances?status=G&rows=all'
      )

      expect(res.status).toBe(200)
      // Routed to the list, not to GET /leases/:id.
      expect(getLeaseSpy).not.toHaveBeenCalled()
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['G'],
          rows: 'all',
          page: 1,
          limit: 50,
        })
      )
      expect(res.body.content).toEqual([
        expect.objectContaining({
          ...buildHomeInsuranceListItem(),
          fullName: 'Kansen, Knut',
          nationalIdNumber: '199001011234',
        }),
      ])
      expect(res.body._meta.totalRecords).toBe(120)
      const next = res.body._links.find(
        (link: { rel: string }) => link.rel === 'next'
      )
      expect(next.href).toContain('/leases/home-insurances?page=2&limit=50')
      expect(next.href).toContain('status=G')
      expect(next.href).toContain('rows=all')
    })

    it('searches a personnummer by its contact code', async () => {
      jest.spyOn(contactsAdapter, 'getByNationalId').mockResolvedValue({
        ok: true,
        data: factory.domainContact.build({ contactCode: 'P158770' }),
      })
      const listSpy = jest
        .spyOn(tenantLeaseAdapter, 'listHomeInsurances')
        .mockResolvedValue(listPage([]))

      const res = await request(app.callback()).get(
        '/leases/home-insurances?q=199001011234&contactCodes=P999999'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
      // The client's own contactCodes is ignored.
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ q: undefined, contactCodes: ['P158770'] })
      )
    })

    it('answers 503 when a personnummer cannot be looked up', async () => {
      jest
        .spyOn(contactsAdapter, 'getByNationalId')
        .mockResolvedValue({ ok: false, err: 'unknown', statusCode: 500 })
      const listSpy = jest.spyOn(tenantLeaseAdapter, 'listHomeInsurances')

      const res = await request(app.callback()).get(
        '/leases/home-insurances?q=199001011234'
      )

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('upstream-failed')
      expect(listSpy).not.toHaveBeenCalled()
    })

    it('answers 400 on invalid query parameters', async () => {
      const listSpy = jest.spyOn(tenantLeaseAdapter, 'listHomeInsurances')

      const res = await request(app.callback()).get(
        '/leases/home-insurances?limit=501'
      )

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid-query')
      expect(listSpy).not.toHaveBeenCalled()
    })

    it("answers cache-warming with 503 and leasing's Retry-After", async () => {
      jest.spyOn(tenantLeaseAdapter, 'listHomeInsurances').mockResolvedValue({
        ok: false,
        err: 'cache-warming',
        statusCode: 503,
        retryAfter: '12',
      })

      const res = await request(app.callback()).get('/leases/home-insurances')

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('cache-warming')
      expect(res.headers['retry-after']).toBe('12')
    })

    it('answers unknown with 500', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'listHomeInsurances')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/leases/home-insurances')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('unknown')
    })
  })

  describe('GET /leases/home-insurances/export', () => {
    it('exports every matching row, from one call to leasing, in the Länsförsäkringar columns', async () => {
      const listSpy = jest
        .spyOn(tenantLeaseAdapter, 'listAllHomeInsurances')
        .mockResolvedValue({
          ok: true,
          data: [
            buildHomeInsuranceListItem({ rowId: 'row-1' }),
            buildHomeInsuranceListItem({ rowId: 'row-2' }),
          ],
        })
      const batchSpy = jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({
          ok: true,
          data: [factory.domainContact.build({ contactCode: 'P158770' })],
        })
      ;(utilities.createExcelExport as jest.Mock).mockResolvedValue(
        Buffer.from('xlsx')
      )

      const res = await request(app.callback()).get(
        '/leases/home-insurances/export?status=K'
      )

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('spreadsheetml')
      expect(res.headers['content-disposition']).toContain('hemforsakringar')
      // One snapshot of leasing's list, not page by page.
      expect(listSpy).toHaveBeenCalledTimes(1)
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['K'] })
      )
      // One contacts lookup for all rows.
      expect(batchSpy).toHaveBeenCalledTimes(1)

      const exportArgs = (utilities.createExcelExport as jest.Mock).mock
        .calls[0][0]
      expect(exportArgs.columns).toHaveLength(18)
      expect(exportArgs.rowMapper(exportArgs.data[0])).toMatchObject({
        leaseId: '705-001-01-0101/1',
        fullName: 'Kansen, Knut',
        nationalIdNumber: '199001011234',
        monthlyAmount: 80,
        leaseStatus: 'G',
      })
    })

    it('logs no request URL, which can hold a personnummer, when the file cannot be built', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'listAllHomeInsurances')
        .mockResolvedValue({ ok: true, data: [buildHomeInsuranceListItem()] })
      jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({ ok: true, data: [] })
      jest
        .spyOn(contactsAdapter, 'getByNationalId')
        .mockResolvedValue({ ok: false, err: 'not-found', statusCode: 404 })
      ;(utilities.createExcelExport as jest.Mock).mockRejectedValue(
        new Error('out of memory')
      )
      const errorSpy = jest
        .spyOn(utilities.logger, 'error')
        .mockImplementation()

      const res = await request(app.callback()).get(
        '/leases/home-insurances/export?q=199001011234'
      )

      expect(res.status).toBe(500)
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('199001011234')
    })

    it('answers 503 instead of a file when leasing is warming up', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'listAllHomeInsurances')
        .mockResolvedValue({
          ok: false,
          err: 'cache-warming',
          statusCode: 503,
        })

      const res = await request(app.callback()).get(
        '/leases/home-insurances/export'
      )

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('cache-warming')
      expect(res.headers['retry-after']).toBe('30')
      expect(utilities.createExcelExport).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /leases/:leaseId/home-insurance/rows/:rowId', () => {
    it('ends the row and answers with the new row', async () => {
      const infoSpy = jest.spyOn(utilities.logger, 'info')
      const updateSpy = jest
        .spyOn(tenantLeaseAdapter, 'updateLeaseHomeInsuranceRow')
        .mockResolvedValue({
          ok: true,
          data: {
            action: 'ended',
            row: {
              rowId: 'row-2',
              monthlyAmount: 80,
              from: '2024-01-01',
              to: '2024-12-31',
            },
          },
        })

      const res = await request(app.callback())
        .patch('/leases/705-001-01-0101%2F1/home-insurance/rows/row-1')
        .send({ endDate: '2024-12-31', action: 'set-end' })

      expect(res.status).toBe(200)
      expect(updateSpy).toHaveBeenCalledWith('705-001-01-0101/1', 'row-1', {
        endDate: '2024-12-31',
        action: 'set-end',
      })
      expect(res.body.content.row.rowId).toBe('row-2')
      // Exact, so no tenant data can slip into the audit log.
      expect(infoSpy).toHaveBeenCalledWith(
        {
          leaseId: '705-001-01-0101/1',
          rowId: 'row-1',
          action: 'set-end',
          endDate: '2024-12-31',
          outcome: 'ended',
          newRowId: 'row-2',
          user: null,
        },
        'Home insurance row update'
      )
    })

    it('answers 400 on an invalid body without calling leasing', async () => {
      const updateSpy = jest.spyOn(
        tenantLeaseAdapter,
        'updateLeaseHomeInsuranceRow'
      )

      const res = await request(app.callback())
        .patch('/leases/1337/home-insurance/rows/row-1')
        .send({ endDate: '2024-13-01', action: 'remove' })

      expect(res.status).toBe(400)
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it.each([
      ['end-date-before-start', 400],
      ['lease-not-found', 404],
      ['home-insurance-row-changed', 409],
      ['upstream-failed', 503],
      ['unknown', 500],
    ] as const)(
      "passes leasing's %s on as %i and logs the outcome",
      async (err, status) => {
        const infoSpy = jest.spyOn(utilities.logger, 'info')
        jest
          .spyOn(tenantLeaseAdapter, 'updateLeaseHomeInsuranceRow')
          .mockResolvedValue({ ok: false, err })

        const res = await request(app.callback())
          .patch('/leases/1337/home-insurance/rows/row-1')
          .send({ endDate: '2024-12-31', action: 'cancel' })

        expect(res.status).toBe(status)
        expect(res.body.error).toBe(err)
        expect(res.body.reason).toEqual(expect.any(String))
        expect(infoSpy).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: err, newRowId: null }),
          'Home insurance row update'
        )
      }
    )
  })

  describe('home insurance staff roles', () => {
    const appWithRoles = (roles: string[]) => {
      const roleApp = new Koa()
      const roleRouter = new KoaRouter()
      routes(roleRouter)
      roleApp.use(bodyParser())
      roleApp.use(async (ctx, next) => {
        ctx.state.user = {
          preferred_username: 'staff1',
          realm_access: { roles },
        }
        await next()
      })
      roleApp.use(async (ctx, next) =>
        requireRole(requiredRolesFor(ctx.path, ctx.method))(ctx, next)
      )
      roleApp.use(roleRouter.routes())
      return roleApp
    }

    it('answers the list with 403 without home-insurance:read', async () => {
      const listSpy = jest.spyOn(tenantLeaseAdapter, 'listHomeInsurances')

      const res = await request(
        appWithRoles(['api-access', 'home-insurance:write']).callback()
      ).get('/leases/home-insurances')

      expect(res.status).toBe(403)
      expect(listSpy).not.toHaveBeenCalled()
    })

    it('answers the PATCH with 403 without home-insurance:write', async () => {
      const updateSpy = jest.spyOn(
        tenantLeaseAdapter,
        'updateLeaseHomeInsuranceRow'
      )

      const res = await request(
        appWithRoles(['api-access', 'home-insurance:read']).callback()
      )
        .patch('/leases/1337/home-insurance/rows/row-1')
        .send({ endDate: '2024-12-31', action: 'cancel' })

      expect(res.status).toBe(403)
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('lets a home-insurance:write holder change a row and logs who did it', async () => {
      const infoSpy = jest.spyOn(utilities.logger, 'info')
      jest
        .spyOn(tenantLeaseAdapter, 'updateLeaseHomeInsuranceRow')
        .mockResolvedValue({ ok: true, data: { action: 'deleted', row: null } })

      const res = await request(
        appWithRoles(['home-insurance:write']).callback()
      )
        .patch('/leases/1337/home-insurance/rows/row-1')
        .send({ endDate: '2024-12-31', action: 'cancel' })

      expect(res.status).toBe(200)
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user: 'staff1', outcome: 'deleted' }),
        'Home insurance row update'
      )
    })
  })

  describe('GET /leases/search', () => {
    it('resolves buildingManager to kvvAreaCodes before calling leasing', async () => {
      const lookupSpy = jest
        .spyOn(propertyBaseAdapter, 'listKvvAreas')
        .mockResolvedValue({
          ok: true,
          data: [
            factory.kvvAreaWithCostCenter.build({ code: 'KVV21' }),
            factory.kvvAreaWithCostCenter.build({ code: 'KVV22' }),
          ],
        })
      const searchSpy = jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      const res = await request(app.callback()).get(
        '/leases/search?buildingManager=user-1'
      )

      expect(res.status).toBe(200)
      expect(lookupSpy).toHaveBeenCalledWith({ responsibleUserIds: ['user-1'] })
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ kvvAreaCodes: ['KVV21', 'KVV22'] })
      )
      expect(searchSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({ buildingManager: expect.anything() })
      )
    })

    it('forwards sentinel kvvAreaCodes when buildingManager matches no areas', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'listKvvAreas')
        .mockResolvedValue({ ok: true, data: [] })
      const searchSpy = jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      const res = await request(app.callback()).get(
        '/leases/search?buildingManager=user-1'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ kvvAreaCodes: ['__no_match__'] })
      )
    })

    it('returns 500 when building manager resolution fails', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'listKvvAreas')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      const searchSpy = jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      const res = await request(app.callback()).get(
        '/leases/search?buildingManager=user-1'
      )

      expect(res.status).toBe(500)
      expect(searchSpy).not.toHaveBeenCalled()
    })

    it('keeps the Tenfast contact info when contacts-service has no record for that code at all', async () => {
      jest.spyOn(tenantLeaseAdapter, 'searchLeases').mockResolvedValue(
        buildPaginatedResponse([
          buildLeaseSearchResult({
            contacts: [
              {
                contactCode: 'P158770',
                name: 'Andra Handen',
                email: 'fran-tenfast@example.com',
                phone: '0701112233',
              },
            ],
          }),
        ])
      )
      jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({ ok: true, data: [] })

      const res = await request(app.callback()).get('/leases/search')

      expect(res.status).toBe(200)
      expect(res.body.content[0].contacts[0].email).toBe(
        'fran-tenfast@example.com'
      )
      expect(res.body.content[0].contacts[0].phone).toBe('0701112233')
    })

    it('never falls back to Tenfast data for a contact contacts-service has but redacted (e.g. protected identity)', async () => {
      jest.spyOn(tenantLeaseAdapter, 'searchLeases').mockResolvedValue(
        buildPaginatedResponse([
          buildLeaseSearchResult({
            contacts: [
              {
                contactCode: 'P158770',
                name: 'Andra Handen',
                email: 'fran-tenfast@example.com',
                phone: '0701112233',
              },
            ],
          }),
        ])
      )
      jest.spyOn(contactsAdapter, 'getByContactCodeBatch').mockResolvedValue({
        ok: true,
        data: [
          factory.contactsServiceContact.build({
            contactCode: 'P158770',
            communication: {
              emailAddresses: [],
              phoneNumbers: [],
              specialAttention: false,
            },
          }),
        ],
      })

      const res = await request(app.callback()).get('/leases/search')

      expect(res.status).toBe(200)
      expect(res.body.content[0].contacts[0].email).toBeNull()
      expect(res.body.content[0].contacts[0].phone).toBeNull()
    })

    it('redacts contact info to null when contacts-service returns an error status', async () => {
      jest.spyOn(tenantLeaseAdapter, 'searchLeases').mockResolvedValue(
        buildPaginatedResponse([
          buildLeaseSearchResult({
            contacts: [
              {
                contactCode: 'P158770',
                name: 'Andra Handen',
                email: 'fran-tenfast@example.com',
                phone: '0701112233',
              },
            ],
          }),
        ])
      )
      jest.spyOn(contactsAdapter, 'getByContactCodeBatch').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get('/leases/search')

      expect(res.status).toBe(200)
      expect(res.body.content[0].contacts[0].email).toBeNull()
      expect(res.body.content[0].contacts[0].phone).toBeNull()
    })

    it('redacts contact info to null when the contacts-service request throws', async () => {
      jest.spyOn(tenantLeaseAdapter, 'searchLeases').mockResolvedValue(
        buildPaginatedResponse([
          buildLeaseSearchResult({
            contacts: [
              {
                contactCode: 'P158770',
                name: 'Andra Handen',
                email: 'fran-tenfast@example.com',
                phone: '0701112233',
              },
            ],
          }),
        ])
      )
      jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockRejectedValue(new Error('timeout'))

      const res = await request(app.callback()).get('/leases/search')

      expect(res.status).toBe(200)
      expect(res.body.content[0].contacts[0].email).toBeNull()
      expect(res.body.content[0].contacts[0].phone).toBeNull()
    })

    it('matches a contact code that has extra whitespace', async () => {
      jest.spyOn(tenantLeaseAdapter, 'searchLeases').mockResolvedValue(
        buildPaginatedResponse([
          buildLeaseSearchResult({
            contacts: [
              {
                contactCode: ' P158770 ',
                name: 'Andra Handen',
                email: 'fran-tenfast@example.com',
                phone: '0701112233',
              },
            ],
          }),
        ])
      )
      const batchSpy = jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({
          ok: true,
          data: [
            factory.contactsServiceContact.build({
              contactCode: 'P158770',
              communication: {
                emailAddresses: [
                  {
                    emailAddress: 'fran-contacts-service@example.com',
                    isPrimary: true,
                    type: 'unspecified',
                  },
                ],
                phoneNumbers: [
                  {
                    phoneNumber: '0709998877',
                    isPrimary: true,
                    type: 'unspecified',
                  },
                ],
                specialAttention: false,
              },
            }),
          ],
        })

      const res = await request(app.callback()).get('/leases/search')

      expect(res.status).toBe(200)
      expect(batchSpy).toHaveBeenCalledWith(['P158770'], expect.anything())
      expect(res.body.content[0].contacts[0].email).toBe(
        'fran-contacts-service@example.com'
      )
    })

    it('resolves a personnummer in q to a contact code before calling leasing', async () => {
      jest.spyOn(contactsAdapter, 'getByNationalId').mockResolvedValue({
        ok: true,
        data: factory.contactsServiceContact.build({ contactCode: 'P158770' }),
      })
      const searchSpy = jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      const res = await request(app.callback()).get(
        '/leases/search?q=198001011234'
      )

      expect(res.status).toBe(200)
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'P158770' })
      )
    })

    it('leaves q untouched when it does not match a contact', async () => {
      jest
        .spyOn(contactsAdapter, 'getByNationalId')
        .mockResolvedValue({ ok: false, err: 'not-found' })
      const searchSpy = jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      const res = await request(app.callback()).get(
        '/leases/search?q=198001011234'
      )

      expect(res.status).toBe(200)
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ q: '198001011234' })
      )
    })
  })

  describe('GET /leases/export', () => {
    it('resolves buildingManager to kvvAreaCodes before calling leasing', async () => {
      ;(utilities.createExcelExport as jest.Mock).mockResolvedValue(
        Buffer.from('excel')
      )
      const lookupSpy = jest
        .spyOn(propertyBaseAdapter, 'listKvvAreas')
        .mockResolvedValue({
          ok: true,
          data: [factory.kvvAreaWithCostCenter.build({ code: 'KVV21' })],
        })
      const exportSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForExport')
        .mockResolvedValue({
          ok: true,
          data: [buildLeaseSearchResult({ contacts: [] })],
        })

      const res = await request(app.callback()).get(
        '/leases/export?buildingManager=user-1'
      )

      expect(res.status).toBe(200)
      expect(lookupSpy).toHaveBeenCalledWith({ responsibleUserIds: ['user-1'] })
      expect(exportSpy).toHaveBeenCalledWith(
        expect.objectContaining({ kvvAreaCodes: ['KVV21'] })
      )
      expect(exportSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({ buildingManager: expect.anything() })
      )
    })

    it('returns 503 when the lease cache is warming up', async () => {
      jest.spyOn(tenantLeaseAdapter, 'getLeasesForExport').mockRejectedValue(
        Object.assign(new Error('Service Unavailable'), {
          isAxiosError: true,
          response: { status: 503 },
        })
      )

      const res = await request(app.callback()).get('/leases/export')

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('Lease service is warming up')
    })

    it('resolves a personnummer in q to a contact code before calling leasing', async () => {
      ;(utilities.createExcelExport as jest.Mock).mockResolvedValue(
        Buffer.from('excel')
      )
      jest.spyOn(contactsAdapter, 'getByNationalId').mockResolvedValue({
        ok: true,
        data: factory.contactsServiceContact.build({ contactCode: 'P158770' }),
      })
      const exportSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForExport')
        .mockResolvedValue({ ok: true, data: [] })

      const res = await request(app.callback()).get(
        '/leases/export?q=198001011234'
      )

      expect(res.status).toBe(200)
      expect(exportSpy).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'P158770' })
      )
    })

    it('enriches contacts from contacts-service before building the export', async () => {
      ;(utilities.createExcelExport as jest.Mock).mockResolvedValue(
        Buffer.from('excel')
      )
      jest.spyOn(tenantLeaseAdapter, 'getLeasesForExport').mockResolvedValue({
        ok: true,
        data: [
          buildLeaseSearchResult({
            contacts: [
              {
                contactCode: 'P158770',
                name: 'Andra Handen',
                email: 'fran-tenfast@example.com',
                phone: '0701112233',
              },
            ],
          }),
        ],
      })
      jest.spyOn(contactsAdapter, 'getByContactCodeBatch').mockResolvedValue({
        ok: true,
        data: [
          factory.contactsServiceContact.build({
            contactCode: 'P158770',
            communication: {
              emailAddresses: [
                {
                  emailAddress: 'fran-contacts-service@example.com',
                  isPrimary: true,
                  type: 'unspecified',
                },
              ],
              phoneNumbers: [
                {
                  phoneNumber: '0709998877',
                  isPrimary: true,
                  type: 'unspecified',
                },
              ],
              specialAttention: false,
            },
          }),
        ],
      })

      const res = await request(app.callback()).get('/leases/export')

      expect(res.status).toBe(200)
      const exportArgs = (utilities.createExcelExport as jest.Mock).mock
        .calls[0][0]
      expect(exportArgs.data[0].contacts[0].email).toBe(
        'fran-contacts-service@example.com'
      )
      expect(exportArgs.data[0].contacts[0].phone).toBe('0709998877')
    })
  })

  describe('GET /leases/for-csc', () => {
    const validContact = () => factory.contact.build({ contactCode: 'P158770' })
    const validRentalProperty = () =>
      factory.rentalPropertyInfo.build({
        id: '705-001-01-0101',
        address: {
          street: 'Stentorpsgatan 9 A',
          number: '',
          postalCode: '72216',
          city: 'Västerås',
        },
      })
    const validLease = () =>
      buildLeaseSearchResult({
        leaseId: '705-001-01-0101/1',
        contacts: [
          {
            contactCode: 'P158770',
            name: 'Test Testsson',
            email: null,
            phone: null,
          },
        ],
        startDate: new Date('2024-01-01'),
      })

    it('returns 200 with empty array when no leases found', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('returns 500 if searchLeases throws', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockRejectedValue(new Error('adapter error'))

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(500)
    })

    it('returns 503 when the lease cache is warming up', async () => {
      jest.spyOn(tenantLeaseAdapter, 'searchLeases').mockRejectedValue(
        Object.assign(new Error('Service Unavailable'), {
          isAxiosError: true,
          response: { status: 503 },
        })
      )

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('Lease service is warming up')
    })

    it('calls searchLeases with objectType bostad and status Current', async () => {
      const searchSpy = jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      await request(app.callback()).get('/leases/for-csc')

      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          objectType: 'bostad',
          status: 'Current',
        })
      )
    })

    it('enforces max limit of 500 even if higher value is passed as query param', async () => {
      const searchSpy = jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([]))

      await request(app.callback()).get('/leases/for-csc?limit=9999')

      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ limit: '500' })
      )
    })

    it('filters out lease with no contacts', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(
          buildPaginatedResponse([buildLeaseSearchResult({ contacts: [] })])
        )

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out lease when contact fetch fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: false, err: 'not-found', statusCode: 404 })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: validRentalProperty() })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out lease when rental property fetch fails', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: validContact() })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 500, data: undefined })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out lease for contact with protectedIdentity', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({
          ok: true,
          data: factory.contact.build({ protectedIdentity: true }),
        })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: validRentalProperty() })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out lease for deceased contact', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({
          ok: true,
          data: factory.contact.build({ deceased: true }),
        })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: validRentalProperty() })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out lease for emigrated contact', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({
          ok: true,
          data: factory.contact.build({ emigrated: true }),
        })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: validRentalProperty() })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out lease for contact with noAdvertising', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({
          ok: true,
          data: factory.contact.build({ noAdvertising: true }),
        })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: validRentalProperty() })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out lease for company contact (contactCode not starting with P)', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({
          ok: true,
          data: factory.contact.build({ contactCode: 'K123456' }),
        })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: validRentalProperty() })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('filters out rental object with test id starting with 000-000', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([validLease()]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: validContact() })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({
          status: 200,
          data: factory.rentalPropertyInfo.build({ id: '000-000-01-0101' }),
        })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('returns correctly mapped lease data for a valid lease', async () => {
      const lease = validLease()
      const contact = validContact()
      const rentalProperty = validRentalProperty()

      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([lease]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: contact })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: rentalProperty })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(res.body.content[0]).toMatchObject({
        division_1038: lease.leaseId,
        division_1501: contact.contactCode,
        respondent_name_first: contact.firstName,
        respondent_name_last: contact.lastName,
        respondent_email: contact.emailAddress,
        object_ref_nr: rentalProperty.id,
        division_1011: rentalProperty.districtCode,
        division_1048: rentalProperty.district,
        division_1242: rentalProperty.marketArea,
      })
    })

    it('maps null enrichment fields to empty strings for CSC export', async () => {
      const lease = validLease()
      const contact = validContact()
      const rentalProperty = factory.rentalPropertyInfo.build({
        id: '705-001-01-0101',
        districtCode: null,
        district: null,
        marketAreaCode: null,
        marketArea: null,
        building: {
          buildingCode: null,
          building: null,
          buildingTypeCode: null,
          buildingTypeCaption: null,
        },
        address: {
          street: 'Stentorpsgatan 9 A',
          number: '',
          postalCode: '72216',
          city: 'Västerås',
        },
      })

      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([lease]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: contact })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: rentalProperty })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(res.body.content[0]).toMatchObject({
        division_1011: '',
        division_1048: '',
        division_1242: '',
        real_estate_type: '',
      })
    })

    it('response _meta count reflects number of leases after filtering', async () => {
      const lease1 = buildLeaseSearchResult({
        leaseId: '705-001-01-0101/1',
        contacts: [
          {
            contactCode: 'P158770',
            name: 'Test Testsson',
            email: null,
            phone: null,
          },
        ],
        startDate: new Date('2024-01-01'),
      })
      const lease2 = buildLeaseSearchResult({
        leaseId: '705-001-01-0102/1',
        contacts: [
          {
            contactCode: 'P158771',
            name: 'Test Testsson 2',
            email: null,
            phone: null,
          },
        ],
        startDate: new Date('2024-01-01'),
      })

      jest
        .spyOn(tenantLeaseAdapter, 'searchLeases')
        .mockResolvedValue(buildPaginatedResponse([lease1, lease2]))
      jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.contact.build({ contactCode: 'P158770' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          data: factory.contact.build({
            contactCode: 'P158771',
            deceased: true,
          }),
        })
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfoFromXpand')
        .mockResolvedValue({ status: 200, data: validRentalProperty() })

      const res = await request(app.callback()).get('/leases/for-csc')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(res.body._meta.count).toBe(1)
    })
  })
})
