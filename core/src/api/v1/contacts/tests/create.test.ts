import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import * as contactsAdapterModule from '../../../../adapters/contacts-adapter'
import { WaitingListType } from '@onecore/types'
import {
  NewContactProfileAndWaitingListsResult,
  setUpNewContactProfileAndWaitingLists,
} from '../../../../processes/contacts'
import { Config } from '@/common/config'

jest.mock('../../../../adapters/contacts-adapter')
// The profile and queue steps are covered by the process's own tests; here
// only the route's handling of the contact and of the process outcome is.
jest.mock('../../../../processes/contacts', () => ({
  ...jest.requireActual('../../../../processes/contacts'),
  setUpNewContactProfileAndWaitingLists: jest.fn(),
}))

const mockSetUp = setUpNewContactProfileAndWaitingLists as jest.MockedFunction<
  typeof setUpNewContactProfileAndWaitingLists
>

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
  mockSetUp.mockResolvedValue({
    applicationProfile: { status: 'skipped' },
    waitingLists: [],
    warnings: [],
  })
})

describe('POST /v1/contacts', () => {
  it('creates the contact, then sets up its profile and waiting lists', async () => {
    mockSetUp.mockResolvedValue({
      applicationProfile: { status: 'created' },
      waitingLists: [
        { waitingListType: WaitingListType.Housing, status: 'created' },
        { waitingListType: WaitingListType.ParkingSpace, status: 'created' },
      ],
      warnings: [],
    })

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(
        body({
          applicationProfile: profile,
          waitingLists: [WaitingListType.Housing, WaitingListType.ParkingSpace],
        })
      )

    expect(res.status).toBe(201)
    expect(mockSetUp).toHaveBeenCalledWith('P069077', {
      applicationProfile: profile,
      waitingLists: [WaitingListType.Housing, WaitingListType.ParkingSpace],
    })
    expect(res.body.content.contactCode).toBe('P069077')
    expect(res.body.content.applicationProfile).toEqual({ status: 'created' })
    expect(res.body.content.waitingLists).toEqual([
      { waitingListType: WaitingListType.Housing, status: 'created' },
      { waitingListType: WaitingListType.ParkingSpace, status: 'created' },
    ])
    expect(res.body.warnings).toBeUndefined()
  })

  it('passes no profile and no waiting lists when none are requested', async () => {
    const res = await request(app.callback()).post('/v1/contacts').send(body())

    expect(res.status).toBe(201)
    expect(mockSetUp).toHaveBeenCalledWith('P069077', {
      applicationProfile: undefined,
      waitingLists: [],
    })
    expect(res.body.content.applicationProfile).toEqual({ status: 'skipped' })
    expect(res.body.content.waitingLists).toEqual([])
  })

  it('rejects an invalid body before touching anything', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts')
      .send({ firstName: 'Test' })

    expect(res.status).toBe(400)
    expect(mockCreateContact).not.toHaveBeenCalled()
    expect(mockSetUp).not.toHaveBeenCalled()
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
    expect(mockSetUp).not.toHaveBeenCalled()
  })

  it('maps an unreachable write backend to 503', async () => {
    mockCreateContact.mockResolvedValue({ ok: false, err: 'xpand-unavailable' })

    const res = await request(app.callback()).post('/v1/contacts').send(body())

    expect(res.status).toBe(503)
  })

  /**
   * The contact exists from here on and cannot be removed, so a failed later
   * step must never produce an error status — that would invite a retry which
   * the duplicate check would then block.
   */
  it('still returns 201 when later steps fail, with their outcomes and warnings', async () => {
    const outcome: NewContactProfileAndWaitingListsResult = {
      applicationProfile: { status: 'failed', error: 'unknown' },
      waitingLists: [
        {
          waitingListType: WaitingListType.Housing,
          status: 'failed',
          error: '500',
        },
        { waitingListType: WaitingListType.Storage, status: 'created' },
      ],
      warnings: [
        'Kunden skapades men hushållsuppgifterna kunde inte sparas.',
        'Kunden skapades men kunde inte ställas i kön för bostad.',
      ],
    }
    mockSetUp.mockResolvedValue(outcome)

    const res = await request(app.callback())
      .post('/v1/contacts')
      .send(
        body({
          applicationProfile: profile,
          waitingLists: [WaitingListType.Housing, WaitingListType.Storage],
        })
      )

    expect(res.status).toBe(201)
    expect(res.body.content.contactCode).toBe('P069077')
    expect(res.body.content.applicationProfile).toEqual(
      outcome.applicationProfile
    )
    expect(res.body.content.waitingLists).toEqual(outcome.waitingLists)
    expect(res.body.warnings).toEqual(outcome.warnings)
  })
})
