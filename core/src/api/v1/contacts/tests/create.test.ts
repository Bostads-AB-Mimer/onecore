import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import * as contactsAdapterModule from '../../../../adapters/contacts-adapter'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import { Config } from '@/common/config'

jest.mock('../../../../adapters/contacts-adapter')
jest.mock('../../../../adapters/leasing-adapter')

const mockCreateContact = jest.fn()

;(contactsAdapterModule.makeContactsAdapter as jest.Mock).mockReturnValue({
  listContacts: jest.fn(),
  getByContactCodes: jest.fn(),
  getByContactCode: jest.fn(),
  getByTrusteeOfContactCode: jest.fn(),
  getByNationalId: jest.fn(),
  listByPhoneNumber: jest.fn(),
  syncContacts: jest.fn(),
  createContact: mockCreateContact,
})

const app = new Koa()
app.use(bodyParser())
const koaRouter = new KoaRouter()
const apiRouter = makeOkapiRouter(koaRouter, {
  openapi: { info: { title: 'test' } },
})
routes(apiRouter, { contactsService: { url: 'http://test' } } as Config)
app.use(koaRouter.routes())

const details = {
  addresses: [{ street: 'Storgatan 1', zipCode: '72212', city: 'Västerås' }],
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  phoneNumbers: [],
}

const body = (overrides: Record<string, unknown> = {}) => ({
  type: 'individual',
  nationalId: '199007292387',
  firstName: 'Test',
  lastName: 'Testsson',
  ...details,
  ...overrides,
})

const organisationBody = (overrides: Record<string, unknown> = {}) => ({
  type: 'organisation',
  organisationNumber: '5560160680',
  name: 'Testbolag Ett AB',
  category: 'F',
  ...details,
  ...overrides,
})

const profile = {
  numAdults: 1,
  numChildren: 0,
  housingType: 'RENTAL',
  housingTypeDescription: null,
  landlord: 'Mimer',
  housingReference: { email: 'ref@example.com', phone: '0701234567' },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateContact.mockResolvedValue({
    ok: true,
    data: {
      contactCode: 'P069077',
      contact: null,
      conversion: { status: 'not-applicable' },
    },
  })
  ;(
    leasingAdapter.createOrUpdateApplicationProfileByContactCode as jest.Mock
  ).mockResolvedValue({ ok: true, data: {} })
  ;(leasingAdapter.addApplicantToWaitingList as jest.Mock).mockResolvedValue({
    status: 201,
  })
})

describe('POST /v1/contacts', () => {
  it('creates the contact and the profile', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(body({ applicationProfile: profile }))

    expect(res.status).toBe(201)
    expect(res.body.content.contactCode).toBe('P069077')
    expect(res.body.content.applicationProfile.status).toBe('created')
    expect(res.body.warnings).toBeUndefined()
  })

  it('rejects an invalid body before touching anything', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts')
      .send({ firstName: 'Test' })

    expect(res.status).toBe(400)
    expect(mockCreateContact).not.toHaveBeenCalled()
  })

  /**
   * Nothing was created, so this must stay a plain failure — and no later step
   * may run against a contact that does not exist.
   */
  it('returns 409 on a duplicate and skips every later step', async () => {
    mockCreateContact.mockResolvedValue({
      ok: false,
      err: 'duplicate-contact',
      detail: 'P012345',
    })

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(body({ applicationProfile: profile }))

    expect(res.status).toBe(409)
    expect(res.body.detail).toBe('P012345')
    expect(
      leasingAdapter.createOrUpdateApplicationProfileByContactCode
    ).not.toHaveBeenCalled()
  })

  it('maps an unreachable write backend to 503', async () => {
    mockCreateContact.mockResolvedValue({ ok: false, err: 'xpand-unavailable' })

    const res = await request(app.callback()).post('/v1/contacts').send(body())

    expect(res.status).toBe(503)
  })

  /**
   * The contact exists from here on and cannot be removed, so a later failure
   * must never produce an error status — that would invite a retry which the
   * duplicate check would then block.
   */
  it('still returns 201 when the application profile fails', async () => {
    ;(
      leasingAdapter.createOrUpdateApplicationProfileByContactCode as jest.Mock
    ).mockResolvedValue({ ok: false, err: 'unknown' })

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(body({ applicationProfile: profile }))

    expect(res.status).toBe(201)
    expect(res.body.content.contactCode).toBe('P069077')
    expect(res.body.content.applicationProfile.status).toBe('failed')
    expect(res.body.warnings).toHaveLength(1)
  })

  it('skips the profile when none is supplied', async () => {
    const res = await request(app.callback()).post('/v1/contacts').send(body())

    expect(res.status).toBe(201)
    expect(res.body.content.applicationProfile.status).toBe('skipped')
    expect(
      leasingAdapter.createOrUpdateApplicationProfileByContactCode
    ).not.toHaveBeenCalled()
  })

  it('enrols the contact in each requested waiting list', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(body({ waitingLists: [2, 1] }))

    expect(res.status).toBe(201)
    expect(leasingAdapter.addApplicantToWaitingList).toHaveBeenCalledTimes(2)
    expect(leasingAdapter.addApplicantToWaitingList).toHaveBeenCalledWith(
      'P069077',
      2
    )
    expect(res.body.content.waitingLists).toEqual([
      { waitingListType: 2, status: 'created' },
      { waitingListType: 1, status: 'created' },
    ])
    expect(res.body.warnings).toBeUndefined()
  })

  it('calls no waiting list when none is requested', async () => {
    const res = await request(app.callback()).post('/v1/contacts').send(body())

    expect(res.status).toBe(201)
    expect(leasingAdapter.addApplicantToWaitingList).not.toHaveBeenCalled()
    expect(res.body.content.waitingLists).toEqual([])
  })

  /**
   * The contact exists once a queue step runs, so a queue failure must be
   * reported per list and as a warning — never as an error status. The other
   * requested lists must still be attempted.
   */
  it('still returns 201 when one queue fails, and reports which one', async () => {
    ;(leasingAdapter.addApplicantToWaitingList as jest.Mock)
      .mockRejectedValueOnce(new Error('Xpand said no'))
      .mockResolvedValueOnce({ status: 201 })

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(body({ waitingLists: [2, 3] }))

    expect(res.status).toBe(201)
    expect(leasingAdapter.addApplicantToWaitingList).toHaveBeenCalledTimes(2)
    expect(res.body.content.waitingLists).toEqual([
      { waitingListType: 2, status: 'failed', error: 'unknown' },
      { waitingListType: 3, status: 'created' },
    ])
    expect(res.body.warnings).toHaveLength(1)
    expect(res.body.warnings[0]).toContain('bostad')
  })

  /**
   * The adapter returns the raw axios response, and core's instance resolves
   * everything below 500 rather than throwing. A rejected enrolment therefore
   * arrives as a normal return value — reporting it as 'created' would tell the
   * caseworker the customer is queued when they are not.
   */
  it('reports a non-201 from leasing as a failed queue, not a created one', async () => {
    ;(leasingAdapter.addApplicantToWaitingList as jest.Mock)
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ status: 201 })

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(body({ waitingLists: [2, 3] }))

    expect(res.status).toBe(201)
    expect(res.body.content.waitingLists).toEqual([
      { waitingListType: 2, status: 'failed', error: '404' },
      { waitingListType: 3, status: 'created' },
    ])
    expect(res.body.warnings).toHaveLength(1)
    expect(res.body.warnings[0]).toContain('bostad')
  })

  it('does not send the orchestration fields to the contacts service', async () => {
    await request(app.callback())
      .post('/v1/contacts')
      .send(body({ applicationProfile: profile, waitingLists: [2] }))

    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.not.objectContaining({
        applicationProfile: expect.anything(),
        waitingLists: expect.anything(),
      })
    )
  })
})

describe('POST /v1/contacts for an organisation', () => {
  beforeEach(() => {
    mockCreateContact.mockResolvedValue({
      ok: true,
      data: {
        contactCode: 'F069077',
        contact: null,
        conversion: { status: 'done' },
      },
    })
  })

  it('creates the organisation and passes the category through', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(organisationBody({ category: 'K' }))

    expect(res.status).toBe(201)
    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'organisation',
        organisationNumber: '5560160680',
        name: 'Testbolag Ett AB',
        category: 'K',
      })
    )
    expect(res.body.content.contactCode).toBe('F069077')
    expect(res.body.content.conversion).toEqual({ status: 'done' })
    expect(res.body.warnings).toBeUndefined()
  })

  it('defaults the category to F', async () => {
    const { category: _omitted, ...withoutCategory } = organisationBody()

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(withoutCategory)

    expect(res.status).toBe(201)
    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'F' })
    )
  })

  /**
   * Queues and the application profile are for housing applicants. Sent for
   * an organisation they are dropped rather than rejected, so the response
   * reports both as not done and no leasing call is made.
   */
  it('never writes a profile or queues, even when they are sent', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(
        organisationBody({ applicationProfile: profile, waitingLists: [2, 3] })
      )

    expect(res.status).toBe(201)
    expect(
      leasingAdapter.createOrUpdateApplicationProfileByContactCode
    ).not.toHaveBeenCalled()
    expect(leasingAdapter.addApplicantToWaitingList).not.toHaveBeenCalled()
    expect(res.body.content.applicationProfile.status).toBe('skipped')
    expect(res.body.content.waitingLists).toEqual([])
    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.not.objectContaining({
        applicationProfile: expect.anything(),
        waitingLists: expect.anything(),
      })
    )
  })

  /**
   * The contact exists once the create succeeds, so a failed conversion must
   * stay a 201: the caseworker is told which person code to finish in Xpand
   * instead of being invited to retry into the duplicate check.
   */
  it('still returns 201 with a warning when the conversion failed', async () => {
    mockCreateContact.mockResolvedValue({
      ok: true,
      data: {
        contactCode: 'P069077',
        contact: null,
        conversion: { status: 'failed', error: 'xpand-db-error' },
      },
    })

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(organisationBody())

    expect(res.status).toBe(201)
    expect(res.body.content.contactCode).toBe('P069077')
    expect(res.body.content.conversion).toEqual({
      status: 'failed',
      error: 'xpand-db-error',
    })
    expect(res.body.warnings).toHaveLength(1)
    expect(res.body.warnings[0]).toContain('P069077')
  })

  /**
   * Core and the contacts service deploy separately. Against a contacts
   * service that predates `conversion`, the contact is still created, so the
   * response must not turn into a 500 that invites a retry.
   */
  it('tolerates a contacts service that reports no conversion', async () => {
    mockCreateContact.mockResolvedValue({
      ok: true,
      data: { contactCode: 'P069077', contact: null },
    })

    const res = await request(app.callback()).post('/v1/contacts').send(body())

    expect(res.status).toBe(201)
    expect(res.body.content.conversion).toEqual({ status: 'not-applicable' })
    expect(res.body.warnings).toBeUndefined()
  })

  it('maps an invalid organisation number to 422', async () => {
    mockCreateContact.mockResolvedValue({
      ok: false,
      err: 'invalid-organisation-number',
      detail: 'Organisationsnumret är inte giltigt.',
    })

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(organisationBody({ organisationNumber: '5560160681' }))

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('invalid-organisation-number')
  })

  it('rejects an organisation without a name before touching anything', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(organisationBody({ name: '' }))

    expect(res.status).toBe(400)
    expect(res.body.detail).toContain('name')
    expect(mockCreateContact).not.toHaveBeenCalled()
  })

  it('rejects a body without a type', async () => {
    const { type: _omitted, ...withoutType } = body()

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(withoutType)

    expect(res.status).toBe(400)
    expect(res.body.detail).toContain('type')
    expect(mockCreateContact).not.toHaveBeenCalled()
  })
})
