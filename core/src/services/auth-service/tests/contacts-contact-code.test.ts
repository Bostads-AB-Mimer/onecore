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
  ...jest.requireActual('../keycloak-contacts'),
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
        username: '199001011239',
        firstName: 'Kim',
        attributes: { phone: ['0700000000'] },
      })
      .put(userPath, (body) => {
        putBody = body
        return true
      })
      .reply(204)

    await expect(ensureContactCode(tokens({}))).resolves.toBe(refreshed)
    expect(contacts.getByNationalId).toHaveBeenCalledWith('199001011239')
    expect(putBody).toEqual({
      id: 'user-1',
      username: '199001011239',
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
      .reply(200, { id: 'user-1', username: '199001011239' })
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
      .reply(200, { id: 'user-1', username: '199001011239' })
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
      .reply(200, { id: 'user-1', username: '199001011239' })
    const original = tokens({})

    await expect(ensureContactCode(original)).resolves.toBe(original)
  })

  it('throws when a repair is needed and the provisioning client is not configured', async () => {
    mockConfig.auth.keycloak.contacts.provisioning.clientSecret = ''

    await expect(ensureContactCode(tokens({}))).rejects.toMatchObject({
      reason: 'provisioning_not_configured',
    })
    expect(contacts.getByNationalId).not.toHaveBeenCalled()
  })

  it('does not need the provisioning client when the contact_code resolves', async () => {
    mockConfig.auth.keycloak.contacts.provisioning.clientSecret = ''
    contacts.getByContactCode.mockResolvedValue(contact('P100'))
    const original = tokens({ contact_code: 'P100' })

    await expect(ensureContactCode(original)).resolves.toBe(original)
  })

  it('throws instead of reporting a missing contact when the token has no refresh_token', async () => {
    const original = { ...tokens({}), refresh_token: undefined }

    await expect(ensureContactCode(original)).rejects.toMatchObject({
      reason: 'keycloak_unavailable',
    })
  })

  it('accepts contact_code as a one-element array (multivalued mapper)', async () => {
    contacts.getByContactCode.mockResolvedValue(contact('P100'))
    const original = tokens({ contact_code: ['P100'] })

    await expect(ensureContactCode(original)).resolves.toBe(original)
    expect(contacts.getByContactCode).toHaveBeenCalledWith('P100')
    expect(contacts.getByNationalId).not.toHaveBeenCalled()
  })

  it('looks up a ten-digit username with separator as twelve digits', async () => {
    contacts.getByNationalId.mockResolvedValue(notFound)
    nock('http://keycloak.test')
      .post(tokenPath)
      .reply(200, { access_token: 'admin-token' })
      .get(userPath)
      .reply(200, { id: 'user-1', username: '900101-1239' })

    await ensureContactCode(tokens({}))

    expect(contacts.getByNationalId).toHaveBeenCalledWith('199001011239')
  })

  it.each(['admin', '199001011234', ''])(
    'does not look up a username that is not a valid personnummer (%p)',
    async (username) => {
      nock('http://keycloak.test')
        .post(tokenPath)
        .reply(200, { access_token: 'admin-token' })
        .get(userPath)
        .reply(200, { id: 'user-1', username })
      const original = tokens({})

      await expect(ensureContactCode(original)).resolves.toBe(original)
      expect(contacts.getByNationalId).not.toHaveBeenCalled()
    }
  )

  it('throws and does not refresh when the PUT fails', async () => {
    contacts.getByNationalId.mockResolvedValue(contact('P200'))
    nock('http://keycloak.test')
      .post(tokenPath)
      .reply(200, { access_token: 'admin-token' })
      .get(userPath)
      .reply(200, { id: 'user-1', username: '199001011239' })
      .put(userPath)
      .reply(403, { error: 'unknown_error' })

    await expect(ensureContactCode(tokens({}))).rejects.toMatchObject({
      reason: 'keycloak_unavailable',
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  describe('when the refresh after the PUT fails', () => {
    beforeEach(() => {
      contacts.getByNationalId.mockResolvedValue(contact('P200'))
      nock('http://keycloak.test')
        .post(tokenPath)
        .reply(200, { access_token: 'admin-token' })
        .get(userPath)
        .reply(200, { id: 'user-1', username: '199001011239' })
        .put(userPath)
        .reply(204)
    })

    it('reports session_ended for invalid_grant', async () => {
      refresh.mockRejectedValue(
        Object.assign(new AxiosError('Bad Request'), {
          response: { status: 400, data: { error: 'invalid_grant' } },
        })
      )

      await expect(ensureContactCode(tokens({}))).rejects.toMatchObject({
        reason: 'session_ended',
      })
    })

    it('reports keycloak_unavailable for anything else', async () => {
      refresh.mockRejectedValue(
        Object.assign(new AxiosError('Bad Gateway'), {
          response: { status: 502, data: {} },
        })
      )

      await expect(ensureContactCode(tokens({}))).rejects.toMatchObject({
        reason: 'keycloak_unavailable',
      })
    })
  })

  it('throws a timeout when the step runs past its budget', async () => {
    contacts.getByContactCode.mockReturnValue(new Promise(() => {}))

    await expect(
      ensureContactCode(tokens({ contact_code: 'P100' }), 20)
    ).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('throws instead of reporting a missing contact when the contacts service fails', async () => {
    contacts.getByContactCode.mockResolvedValue({
      ok: false,
      err: 'unknown',
      statusCode: 500,
    })

    const error = await ensureContactCode(
      tokens({ contact_code: 'P100' })
    ).catch((e) => e)

    expect(error).toBeInstanceOf(ContactCodeError)
    expect(error.reason).toBe('contacts_unavailable')
    expect(error.cause.message).toContain('500')
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
