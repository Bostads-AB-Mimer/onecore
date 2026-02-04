import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as inspectionAdapter from '../../../adapters/inspection-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import * as pdfGenerator from '../helpers/pdf-generator'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import { DetailedXpandInspectionFactory } from '../../../../test/factories/inspection'
import { LeaseFactory } from '../../../../test/factories/lease'
import { ResidenceByRentalIdDetailsFactory } from '../../../../test/factories/residence-details'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('POST /inspections/:inspectionId/send-protocol', () => {
  const mockPdfBuffer = Buffer.from('mock pdf content')

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(leasingAdapter, 'getLeases').mockResolvedValue({})
    jest
      .spyOn(pdfGenerator, 'generateInspectionProtocolPdf')
      .mockResolvedValue(mockPdfBuffer)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should send protocol to new tenant successfully', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      leaseId: 'lease-current',
    })

    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

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

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

    jest
      .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
      .mockResolvedValue({ ok: true, data: mockResidence })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease])

    const sendSpy = jest
      .spyOn(communicationAdapter, 'sendNotificationToContactWithAttachment')
      .mockResolvedValue(undefined)

    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'new-tenant' })

    expect(res.status).toBe(200)
    expect(res.body.content.success).toBe(true)
    expect(res.body.content.recipient).toBe('new-tenant')
    expect(res.body.content.sentTo.emails).toContain('new@example.com')
    expect(res.body.content.sentTo.contactNames).toContain('New Tenant')
    expect(res.body.content.sentTo.contractId).toBe('lease-new')
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: 'new@example.com' }),
      expect.stringContaining('Besiktningsprotokoll'),
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({
          filename: expect.stringContaining('.pdf'),
          content: mockPdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        }),
      ])
    )
  })

  it('should send protocol to previous tenant successfully', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      leaseId: 'lease-current',
    })

    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

    const newTenantLease = LeaseFactory.build({
      leaseId: 'lease-new',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [],
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

    jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

    jest
      .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
      .mockResolvedValue({ ok: true, data: mockResidence })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease, previousTenantLease])

    const sendSpy = jest
      .spyOn(communicationAdapter, 'sendNotificationToContactWithAttachment')
      .mockResolvedValue(undefined)

    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'previous-tenant' })

    expect(res.status).toBe(200)
    expect(res.body.content.success).toBe(true)
    expect(res.body.content.recipient).toBe('previous-tenant')
    expect(res.body.content.sentTo.emails).toContain('previous@example.com')
    expect(sendSpy).toHaveBeenCalled()
  })

  it('should send to multiple contacts on same lease', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      leaseId: 'lease-current',
    })

    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

    const newTenantLease = LeaseFactory.build({
      leaseId: 'lease-new',
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

    jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

    jest
      .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
      .mockResolvedValue({ ok: true, data: mockResidence })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease])

    const sendSpy = jest
      .spyOn(communicationAdapter, 'sendNotificationToContactWithAttachment')
      .mockResolvedValue(undefined)

    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'new-tenant' })

    expect(res.status).toBe(200)
    expect(res.body.content.success).toBe(true)
    expect(res.body.content.sentTo.emails).toHaveLength(2)
    expect(res.body.content.sentTo.emails).toContain('first@example.com')
    expect(res.body.content.sentTo.emails).toContain('second@example.com')
    expect(sendSpy).toHaveBeenCalledTimes(2)
  })

  it('should return 400 when no contract found for requested recipient', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      leaseId: 'lease-current',
    })

    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

    const newTenantLease = LeaseFactory.build({
      leaseId: 'lease-new',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [],
    })

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

    jest
      .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
      .mockResolvedValue({ ok: true, data: mockResidence })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease])

    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'previous-tenant' })

    expect(res.status).toBe(400)
    expect(res.body.content.success).toBe(false)
    expect(res.body.content.error).toContain('No contract found')
  })

  it('should return 400 when contract has no email addresses', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      leaseId: 'lease-current',
    })

    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

    const newTenantLease = LeaseFactory.build({
      leaseId: 'lease-new',
      type: 'Bostadskontrakt',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [
        {
          contactCode: 'contact-1',
          contactKey: 'key-1',
          firstName: 'No',
          lastName: 'Email',
          fullName: 'No Email',
          nationalRegistrationNumber: '1234567890',
          birthDate: new Date('1990-01-01'),
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

    jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

    jest
      .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
      .mockResolvedValue({ ok: true, data: mockResidence })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease])

    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'new-tenant' })

    expect(res.status).toBe(400)
    expect(res.body.content.success).toBe(false)
    expect(res.body.content.error).toContain('No email addresses found')
  })

  it('should return 400 on invalid request body', async () => {
    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'invalid-recipient' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body')
  })

  it('should return 404 when inspection not found', async () => {
    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: false, err: 'not-found', statusCode: 404 })

    const res = await request(app.callback())
      .post('/inspections/non-existent/send-protocol')
      .send({ recipient: 'new-tenant' })

    expect(res.status).toBe(404)
  })

  it('should return 500 when PDF generation fails', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      leaseId: 'lease-current',
    })

    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

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

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

    jest
      .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
      .mockResolvedValue({ ok: true, data: mockResidence })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease])

    jest
      .spyOn(pdfGenerator, 'generateInspectionProtocolPdf')
      .mockRejectedValue(new Error('PDF generation failed'))

    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'new-tenant' })

    expect(res.status).toBe(500)
    expect(res.body.content.success).toBe(false)
    expect(res.body.content.error).toContain('Failed to generate PDF')
  })

  it('should handle communication service failure', async () => {
    const mockInspection = DetailedXpandInspectionFactory.build({
      id: 'inspection-123',
      residenceId: 'res-1',
      leaseId: 'lease-current',
    })

    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

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

    jest
      .spyOn(inspectionAdapter, 'getXpandInspectionById')
      .mockResolvedValue({ ok: true, data: mockInspection })

    jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

    jest
      .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
      .mockResolvedValue({ ok: true, data: mockResidence })

    jest
      .spyOn(leasingAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([newTenantLease])

    jest
      .spyOn(communicationAdapter, 'sendNotificationToContactWithAttachment')
      .mockRejectedValue(new Error('Communication service error'))

    const res = await request(app.callback())
      .post('/inspections/inspection-123/send-protocol')
      .send({ recipient: 'new-tenant' })

    expect(res.status).toBe(200)
    expect(res.body.content.success).toBe(false)
    expect(res.body.content.error).toBeDefined()
  })
})
