import nock from 'nock'
import { AxiosError } from 'axios'

const mockConfig = {
  auth: {
    keycloak: {
      url: 'http://keycloak.test',
      contacts: {
        realm: 'mimer-contacts',
        clientId: 'mina-sidor',
        clientSecret: 'client-secret',
        provisioning: {
          clientId: 'mimer-contacts-provisioning',
          clientSecret: 'provisioning-secret',
        },
      },
    },
  },
}

jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: mockConfig,
}))

jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('../../../adapters/contacts-adapter', () => ({
  contactsAdapter: {
    getByContactCode: jest.fn(),
    getByNationalId: jest.fn(),
  },
}))

jest.mock('../keycloak-contacts', () => ({
  refreshContactsAccessToken: jest.fn(),
}))

import { contactsAdapter } from '../../../adapters/contacts-adapter'
import { refreshContactsAccessToken } from '../keycloak-contacts'
import { ContactCodeError, ensureContactCode } from '../contacts-contact-code'

const contacts = contactsAdapter as jest.Mocked<typeof contactsAdapter>
const refresh = refreshContactsAccessToken as jest.MockedFunction<
  typeof refreshContactsAccessToken
>

const tokenPath = '/realms/mimer-contacts/protocol/openid-connect/token'
const userPath = '/admin/realms/mimer-contacts/users/user-1'

function jwt(claims: Record<string, unknown>): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'none' })}.${part(claims)}.sig`
}

function tokens(claims: Record<string, unknown>) {
  return {
    access_token: jwt({ sub: 'user-1', ...claims }),
    refresh_token: 'rt-1',
    expires_in: 300,
    token_type: 'Bearer',
  }
}

const refreshed = {
  access_token: jwt({ sub: 'user-1', contact_code: 'P200' }),
  refresh_token: 'rt-2',
  expires_in: 300,
  token_type: 'Bearer',
}

const contact = (contactCode: string) =>
  ({ ok: true, data: { contactCode } }) as never

const notFound = { ok: false, err: 'not-found', statusCode: 404 } as const

describe('ensureContactCode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    nock.cleanAll()
    mockConfig.auth.keycloak.contacts.provisioning.clientSecret =
      'provisioning-secret'
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('keeps a contact_code that still resolves, without touching Keycloak', async () => {
    contacts.getByContactCode.mockResolvedValue(contact('P100'))
    const original = tokens({ contact_code: 'P100' })

    await expect(ensureContactCode(original)).resolves.toBe(original)
    expect(contacts.getByNationalId).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('sets contact_code from the personnummer and returns refreshed tokens', async () => {
    contacts.getByNationalId.mockResolvedValue(contact('P200'))
    refresh.mockResolvedValue(refreshed)

    let putBody: Record<string, any> | undefined
    nock('http://keycloak.test')
      .post(tokenPath, (body) => {
        expect(body).toMatchObject({
          grant_type: 'client_credentials',
          client_id: 'mimer-contacts-provisioning',
          client_secret: 'provisioning-secret',
        })
        return true
      })
      .reply(200, { access_token: 'admin-token' })
      .get(userPath)
      .matchHeader('authorization', 'Bearer admin-token')
      .reply(200, {
        id: 'user-1',
        username: '199001011234',
        firstName: 'Kim',
        attributes: { phone: ['0700000000'] },
      })
      .put(userPath, (body) => {
        putBody = body
        return true
      })
      .reply(204)

    await expect(ensureContactCode(tokens({}))).resolves.toBe(refreshed)
    expect(contacts.getByNationalId).toHaveBeenCalledWith('199001011234')
    expect(putBody).toEqual({
      id: 'user-1',
      username: '199001011234',
      firstName: 'Kim',
      attributes: { phone: ['0700000000'], contact_code: ['P200'] },
    })
    expect(refresh).toHaveBeenCalledWith('rt-1')
    expect(nock.isDone()).toBe(true)
  })

  it('repairs a contact_code whose contact no longer exists', async () => {
    contacts.getByContactCode.mockResolvedValue(notFound)
    contacts.getByNationalId.mockResolvedValue(contact('P200'))
    refresh.mockResolvedValue(refreshed)
    nock('http://keycloak.test')
      .post(tokenPath)
      .reply(200, { access_token: 'admin-token' })
      .get(userPath)
      .reply(200, { id: 'user-1', username: '199001011234' })
      .put(userPath)
      .reply(204)

    await expect(
      ensureContactCode(tokens({ contact_code: 'P-GONE' }))
    ).resolves.toBe(refreshed)
  })

  it('returns the tokens unchanged when the personnummer has no contact', async () => {
    contacts.getByNationalId.mockResolvedValue(notFound)
    nock('http://keycloak.test')
      .post(tokenPath)
      .reply(200, { access_token: 'admin-token' })
      .get(userPath)
      .reply(200, { id: 'user-1', username: '199001011234' })
    const original = tokens({})

    await expect(ensureContactCode(original)).resolves.toBe(original)
    expect(refresh).not.toHaveBeenCalled()
    expect(nock.isDone()).toBe(true)
  })

  it('treats a thrown 404 from the contacts service as no contact', async () => {
    contacts.getByNationalId.mockRejectedValue(
      Object.assign(new AxiosError('Not Found'), {
        response: { status: 404 },
      })
    )
    nock('http://keycloak.test')
      .post(tokenPath)
      .reply(200, { access_token: 'admin-token' })
      .get(userPath)
      .reply(200, { id: 'user-1', username: '199001011234' })
    const original = tokens({})

    await expect(ensureContactCode(original)).resolves.toBe(original)
  })

  it('returns the tokens unchanged when the provisioning client is not configured', async () => {
    mockConfig.auth.keycloak.contacts.provisioning.clientSecret = ''
    const original = tokens({})

    await expect(ensureContactCode(original)).resolves.toBe(original)
    expect(contacts.getByNationalId).not.toHaveBeenCalled()
  })

  it('throws instead of reporting a missing contact when the contacts service fails', async () => {
    contacts.getByContactCode.mockResolvedValue({
      ok: false,
      err: 'unknown',
      statusCode: 500,
    })

    await expect(
      ensureContactCode(tokens({ contact_code: 'P100' }))
    ).rejects.toMatchObject({ reason: 'contacts_unavailable' })
  })

  it('throws when Keycloak refuses the provisioning client', async () => {
    nock('http://keycloak.test')
      .post(tokenPath)
      .reply(401, { error: 'unauthorized_client' })

    const error = await ensureContactCode(tokens({})).catch((e) => e)

    expect(error).toBeInstanceOf(ContactCodeError)
    expect(error.reason).toBe('keycloak_unavailable')
  })
})
