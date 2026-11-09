import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import request from 'supertest'
import { WaitingListType } from '@onecore/types'

const mockConfig = {
  minaSidor: { url: 'https://mina-sidor.test/' },
  auth: {
    keycloak: {
      url: 'http://keycloak.test',
      contacts: {
        realm: 'mimer-contacts',
        clientId: 'mina-sidor',
        clientSecret: 'client-secret',
      },
    },
  },
}

jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: mockConfig,
}))

jest.mock('../../../processes/contacts/register-applicant', () => ({
  registerApplicant: jest.fn(),
}))

jest.mock('../contacts-keycloak-provisioning', () => ({
  ...jest.requireActual('../contacts-keycloak-provisioning'),
  isContactsProvisioningConfigured: jest.fn(),
}))

import { registerApplicant } from '../../../processes/contacts/register-applicant'
import { isContactsProvisioningConfigured } from '../contacts-keycloak-provisioning'
import { registerContactsRegistrationRoute } from '../contacts-registration-route'

const register = registerApplicant as jest.MockedFunction<
  typeof registerApplicant
>
const provisioningConfigured =
  isContactsProvisioningConfigured as jest.MockedFunction<
    typeof isContactsProvisioningConfigured
  >

// Valid personnummer around the age boundary on the faked date below (2026).
const TURNS_16_ON_NEW_YEARS_EVE = '201012312383'
const TURNS_16_NEXT_YEAR = '201101012381'

const body = {
  nationalId: '19900101-2385',
  firstName: 'Kim',
  lastName: 'Andersson',
  address: { street: 'Storgatan 1', zipCode: '72211', city: 'Västerås' },
  emailAddress: 'kim@example.com',
  phoneNumbers: [{ phoneNumber: '0701234567' }],
  waitingLists: [WaitingListType.Housing],
}

function buildApp() {
  const app = new Koa()
  const router = new KoaRouter()
  app.use(bodyParser())
  registerContactsRegistrationRoute(router)
  app.use(router.routes())
  return app
}

const post = (payload: object) =>
  request(buildApp().callback()).post('/auth/contacts/register').send(payload)

describe('POST /auth/contacts/register', () => {
  beforeAll(() => {
    // Only Date is faked; supertest and koa need the real timers.
    jest.useFakeTimers({
      now: new Date('2026-11-04T12:00:00Z'),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'hrtime',
        'performance',
      ],
    })
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('goes by the calendar year in Sweden, not in UTC', async () => {
    // 00:30 on New Year's Day in Sweden, still 2026 in UTC.
    jest.setSystemTime(new Date('2026-12-31T23:30:00Z'))
    try {
      const res = await post({ ...body, nationalId: TURNS_16_NEXT_YEAR })
      expect(res.status).toBe(201)
    } finally {
      jest.setSystemTime(new Date('2026-11-04T12:00:00Z'))
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockConfig.auth.keycloak.url = 'http://keycloak.test'
    mockConfig.auth.keycloak.contacts.clientId = 'mina-sidor'
    mockConfig.minaSidor.url = 'https://mina-sidor.test/'
    provisioningConfigured.mockReturnValue(true)
    register.mockResolvedValue({
      outcome: 'created',
      contactCode: 'P123456',
      warnings: [],
    })
  })

  describe('before anything is created', () => {
    it('answers 503 when the provisioning client is not configured', async () => {
      provisioningConfigured.mockReturnValue(false)

      const res = await post(body)

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('registration-not-configured')
      expect(register).not.toHaveBeenCalled()
    })

    it.each([
      ['Keycloak has no URL', () => (mockConfig.auth.keycloak.url = '')],
      [
        'the mina-sidor client the e-mail names is not set',
        () => (mockConfig.auth.keycloak.contacts.clientId = ''),
      ],
      [
        'the link in the e-mail has nowhere to go',
        () => (mockConfig.minaSidor.url = ''),
      ],
    ])('answers 503 when %s', async (_, unset) => {
      unset()

      const res = await post(body)

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('registration-not-configured')
      expect(register).not.toHaveBeenCalled()
    })

    it('answers 400 with the failing fields only, never what was typed', async () => {
      const res = await post({
        ...body,
        emailAddress: 'not-an-email',
        phoneNumbers: [1, 2, 3, 4].map((n) => ({
          phoneNumber: `070000000${n}`,
        })),
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid-request')
      expect(res.body.fields).toEqual(
        expect.arrayContaining(['emailAddress', 'phoneNumbers'])
      )
      expect(JSON.stringify(res.body)).not.toContain('not-an-email')
      expect(register).not.toHaveBeenCalled()
    })

    it('answers 422 invalid-national-id for a number that is not a personnummer', async () => {
      const res = await post({ ...body, nationalId: '199001012384' })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('invalid-national-id')
      expect(register).not.toHaveBeenCalled()
    })

    it('lets someone register in the calendar year they turn 16', async () => {
      const res = await post({ ...body, nationalId: TURNS_16_ON_NEW_YEARS_EVE })

      expect(res.status).toBe(201)
    })

    it('answers 422 too-young before the calendar year they turn 16', async () => {
      const res = await post({ ...body, nationalId: TURNS_16_NEXT_YEAR })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('too-young')
      expect(register).not.toHaveBeenCalled()
    })
  })

  it('registers with the personnummer as twelve digits and answers 201', async () => {
    register.mockResolvedValue({
      outcome: 'created',
      contactCode: 'P123456',
      warnings: ['login-setup-failed'],
    })

    const res = await post(body)

    expect(res.status).toBe(201)
    expect(res.body.content).toEqual({
      outcome: 'created',
      contactCode: 'P123456',
      warnings: ['login-setup-failed'],
    })
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        nationalId: '199001012385',
        emailAddress: 'kim@example.com',
        phoneNumbers: [
          { phoneNumber: '0701234567', type: 'mobile', isPrimary: false },
        ],
        waitingLists: [WaitingListType.Housing],
      })
    )
  })

  it.each(['existing', 'inactive'] as const)(
    "answers 200 with outcome '%s' and no contact code",
    async (outcome) => {
      register.mockResolvedValue({ outcome })

      const res = await post(body)

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({ outcome })
    }
  )

  it.each([
    ['person-lookup-failed', 503],
    ['xpand-unavailable', 503],
    ['xpand-rejected', 422],
    ['invalid-national-id', 422],
    ['contact-outcome-unknown', 502],
  ] as const)('answers a %s failure with %i', async (error, status) => {
    register.mockResolvedValue({ outcome: 'failed', error })

    const res = await post(body)

    expect(res.status).toBe(status)
    expect(res.body.error).toBe(error)
    expect(res.body.detail).toBeUndefined()
  })
})
