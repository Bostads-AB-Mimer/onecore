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

const body = (overrides: Record<string, unknown> = {}) => ({
  nationalId: '199007292387',
  firstName: 'Test',
  lastName: 'Testsson',
  addresses: [{ street: 'Storgatan 1', zipCode: '72212', city: 'Västerås' }],
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  phoneNumbers: [],
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
    data: { contactCode: 'P069077', contact: null },
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
})
