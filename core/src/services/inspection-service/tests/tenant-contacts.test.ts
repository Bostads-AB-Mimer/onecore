import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as inspectionAdapter from '../../../adapters/inspection-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import { DetailedXpandInspectionFactory } from '../../../../test/factories/inspection'
import { LeaseFactory } from '../../../../test/factories/lease'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('GET /inspections/:inspectionId/tenant-contacts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return both new and previous tenant contacts', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      address: 'Testgatan 1',
      apartmentCode: 'A101',
    })

    const newTenantLease = LeaseFactory.build({
      leaseId: 'lease-new',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [
        {
          contactCode: 'contact-1',
          contactKey: 'key-1',
          firstName: 'New',
          lastName: 'Tenant',
          fullName: 'New Tenant',
          nationalRegistrationNumber: '1234567890',
          birthDate: new Date('1990-01-01'),
          address: undefined,
          phoneNumbers: undefined,
          emailAddress: 'new@example.com',
          isTenant: true,
        },
      ],
    })

    const previousTenantLease = LeaseFactory.build({
      leaseId: 'lease-previous',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2023-01-01'),
      tenants: [
        {
          contactCode: 'contact-2',
          contactKey: 'key-2',
          firstName: 'Previous',
          lastName: 'Tenant',
          fullName: 'Previous Tenant',
          nationalRegistrationNumber: '0987654321',
          birthDate: new Date('1985-01-01'),
          address: undefined,
          phoneNumbers: undefined,
          emailAddress: 'previous@example.com',
          isTenant: true,
        },
      ],
    })

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease, previousTenantLease])

    const res = await request(app.callback()).get(
      '/inspections/inspection-123/tenant-contacts'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.inspection.id).toBe('inspection-123')
    expect(res.body.content.inspection.address).toBe('Testgatan 1')
    expect(res.body.content.inspection.apartmentCode).toBe('A101')

    expect(res.body.content.new_tenant).toBeDefined()
    expect(res.body.content.new_tenant.contractId).toBe('lease-new')
    expect(res.body.content.new_tenant.contacts).toHaveLength(1)
    expect(res.body.content.new_tenant.contacts[0].fullName).toBe('New Tenant')
    expect(res.body.content.new_tenant.contacts[0].emailAddress).toBe(
      'new@example.com'
    )

    expect(res.body.content.previous_tenant).toBeDefined()
    expect(res.body.content.previous_tenant.contractId).toBe('lease-previous')
    expect(res.body.content.previous_tenant.contacts).toHaveLength(1)
    expect(res.body.content.previous_tenant.contacts[0].fullName).toBe(
      'Previous Tenant'
    )
    expect(res.body.content.previous_tenant.contacts[0].emailAddress).toBe(
      'previous@example.com'
    )
  })

  it('should return only new tenant when only one contract exists', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
    })

    const newTenantLease = LeaseFactory.build({
      leaseId: 'lease-new',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [
        {
          contactCode: 'contact-1',
          contactKey: 'key-1',
          firstName: 'Only',
          lastName: 'Tenant',
          fullName: 'Only Tenant',
          nationalRegistrationNumber: '1234567890',
          birthDate: new Date('1990-01-01'),
          address: undefined,
          phoneNumbers: undefined,
          emailAddress: 'only@example.com',
          isTenant: true,
        },
      ],
    })

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease])

    const res = await request(app.callback()).get(
      '/inspections/inspection-123/tenant-contacts'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.new_tenant).toBeDefined()
    expect(res.body.content.previous_tenant).toBeUndefined()
  })

  it('should return undefined for both when no housing contracts exist', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
    })

    const parkingLease = LeaseFactory.build({
      leaseId: 'lease-parking',
      type: 'Parkeringskontrakt',
      leaseStartDate: new Date('2024-01-01'),
    })

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([parkingLease])

    const res = await request(app.callback()).get(
      '/inspections/inspection-123/tenant-contacts'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.new_tenant).toBeUndefined()
    expect(res.body.content.previous_tenant).toBeUndefined()
  })

  it('should filter out contacts without email addresses', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
    })

    const lease = LeaseFactory.build({
      leaseId: 'lease-1',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [
        {
          contactCode: 'contact-1',
          contactKey: 'key-1',
          firstName: 'With',
          lastName: 'Email',
          fullName: 'With Email',
          nationalRegistrationNumber: '1234567890',
          birthDate: new Date('1990-01-01'),
          address: undefined,
          phoneNumbers: undefined,
          emailAddress: 'with@example.com',
          isTenant: true,
        },
        {
          contactCode: 'contact-2',
          contactKey: 'key-2',
          firstName: 'Without',
          lastName: 'Email',
          fullName: 'Without Email',
          nationalRegistrationNumber: '0987654321',
          birthDate: new Date('1985-01-01'),
          address: undefined,
          phoneNumbers: undefined,
          emailAddress: undefined,
          isTenant: true,
        },
      ],
    })

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([lease])

    const res = await request(app.callback()).get(
      '/inspections/inspection-123/tenant-contacts'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.new_tenant.contacts).toHaveLength(1)
    expect(res.body.content.new_tenant.contacts[0].fullName).toBe('With Email')
  })

  it('should return multiple contacts per lease', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
    })

    const lease = LeaseFactory.build({
      leaseId: 'lease-1',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [
        {
          contactCode: 'contact-1',
          contactKey: 'key-1',
          firstName: 'First',
          lastName: 'Tenant',
          fullName: 'First Tenant',
          nationalRegistrationNumber: '1234567890',
          birthDate: new Date('1990-01-01'),
          address: undefined,
          phoneNumbers: undefined,
          emailAddress: 'first@example.com',
          isTenant: true,
        },
        {
          contactCode: 'contact-2',
          contactKey: 'key-2',
          firstName: 'Second',
          lastName: 'Tenant',
          fullName: 'Second Tenant',
          nationalRegistrationNumber: '0987654321',
          birthDate: new Date('1985-01-01'),
          address: undefined,
          phoneNumbers: undefined,
          emailAddress: 'second@example.com',
          isTenant: true,
        },
      ],
    })

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([lease])

    const res = await request(app.callback()).get(
      '/inspections/inspection-123/tenant-contacts'
    )

    expect(res.status).toBe(200)
    expect(res.body.content.new_tenant.contacts).toHaveLength(2)
  })

  it('should return 404 when inspection not found', async () => {
    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: false, err: 'not-found', statusCode: 404 })

    const res = await request(app.callback()).get(
      '/inspections/non-existent/tenant-contacts'
    )

    expect(res.status).toBe(404)
  })

  it('should return 500 on error fetching leases', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
    })

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockRejectedValue(new Error('Database error'))

    const res = await request(app.callback()).get(
      '/inspections/inspection-123/tenant-contacts'
    )

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Internal server error')
  })
})
