import nock from 'nock'

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
        setPasswordRedirectUri: 'https://mina-sidor.test/',
      },
    },
  },
}

jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: mockConfig,
}))

import {
  connectContactsKeycloakAdmin,
  isContactsProvisioningConfigured,
  toContactsUsername,
} from '../contacts-keycloak-provisioning'

const keycloak = 'http://keycloak.test'
const tokenPath = '/realms/mimer-contacts/protocol/openid-connect/token'
const usersPath = '/admin/realms/mimer-contacts/users'

function expectProvisioningToken() {
  return nock(keycloak)
    .post(tokenPath, (body) => {
      expect(body).toMatchObject({
        grant_type: 'client_credentials',
        client_id: 'mimer-contacts-provisioning',
        client_secret: 'provisioning-secret',
      })
      return true
    })
    .reply(200, { access_token: 'admin-token' })
}

describe('contacts Keycloak provisioning', () => {
  beforeEach(() => {
    nock.cleanAll()
    mockConfig.auth.keycloak.contacts.provisioning.clientSecret =
      'provisioning-secret'
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('isContactsProvisioningConfigured', () => {
    it('is false without a client secret', () => {
      mockConfig.auth.keycloak.contacts.provisioning.clientSecret = ''
      expect(isContactsProvisioningConfigured()).toBe(false)
    })

    it('is true with client id and secret', () => {
      expect(isContactsProvisioningConfigured()).toBe(true)
    })
  })

  describe('toContactsUsername', () => {
    it.each([
      ['200801011230', '200801011230'],
      ['0801011230', '200801011230'],
      ['080101-1230', '200801011230'],
      ['20080101-1230', '200801011230'],
      // Samordningsnummer: day + 60.
      ['200801611237', '200801611237'],
    ])('turns %s into twelve digits', (input, expected) => {
      expect(toContactsUsername(input)).toBe(expected)
    })

    // A wrong check digit, no digits, and an interim number (a letter in place of a digit).
    it.each(['200801011231', 'not-a-number', '', '20080101T230'])(
      'is null for %p',
      (input) => {
        expect(toContactsUsername(input)).toBeNull()
      }
    )
  })

  describe('getUser', () => {
    it('reads the full user representation by id', async () => {
      const user = {
        id: 'user-1',
        username: '200801011234',
        attributes: { contact_code: ['P123456'] },
      }
      expectProvisioningToken()
        .get(`${usersPath}/user-1`)
        .matchHeader('authorization', 'Bearer admin-token')
        .reply(200, user)

      const admin = await connectContactsKeycloakAdmin()
      await expect(admin.getUser('user-1')).resolves.toEqual(user)
    })
  })

  describe('createPersonUser', () => {
    it('creates an enabled person user with contact_code and returns the id from Location', async () => {
      let created: Record<string, unknown> | undefined
      expectProvisioningToken()
        .post(usersPath, (body) => {
          created = body
          return true
        })
        .matchHeader('authorization', 'Bearer admin-token')
        .reply(201, '', {
          Location: `${keycloak}${usersPath}/new-user-id`,
        })

      const admin = await connectContactsKeycloakAdmin()
      await expect(
        admin.createPersonUser({
          username: '200801011234',
          email: 'kim@example.com',
          contactCode: 'P123456',
        })
      ).resolves.toEqual({ id: 'new-user-id' })

      expect(created).toEqual({
        username: '200801011234',
        email: 'kim@example.com',
        emailVerified: false,
        enabled: true,
        attributes: { contact_code: ['P123456'], account_type: ['person'] },
      })
      expect(nock.isDone()).toBe(true)
    })

    it("answers 'conflict' when Keycloak refuses with 409", async () => {
      expectProvisioningToken()
        .post(usersPath)
        .reply(409, { errorMessage: 'User exists with same username' })

      const admin = await connectContactsKeycloakAdmin()
      await expect(
        admin.createPersonUser({
          username: '200801011234',
          email: 'kim@example.com',
          contactCode: 'P123456',
        })
      ).resolves.toBe('conflict')
    })

    it('throws on any other failure', async () => {
      expectProvisioningToken().post(usersPath).reply(403)

      const admin = await connectContactsKeycloakAdmin()
      await expect(
        admin.createPersonUser({
          username: '200801011234',
          email: 'kim@example.com',
          contactCode: 'P123456',
        })
      ).rejects.toMatchObject({ response: { status: 403 } })
    })

    it('throws when Keycloak answers 201 without a Location header', async () => {
      expectProvisioningToken().post(usersPath).reply(201)

      const admin = await connectContactsKeycloakAdmin()
      await expect(
        admin.createPersonUser({
          username: '200801011234',
          email: 'kim@example.com',
          contactCode: 'P123456',
        })
      ).rejects.toThrow('Location')
    })
  })

  describe('findUserByUsername', () => {
    it('asks for an exact match and returns the user with that username', async () => {
      expectProvisioningToken()
        .get(usersPath)
        .query({
          username: '200801011234',
          exact: 'true',
          briefRepresentation: 'false',
        })
        .reply(200, [{ id: 'user-1', username: '200801011234' }])

      const admin = await connectContactsKeycloakAdmin()
      await expect(admin.findUserByUsername('200801011234')).resolves.toEqual({
        id: 'user-1',
        username: '200801011234',
      })
    })

    it('returns null when no user has the username', async () => {
      expectProvisioningToken().get(usersPath).query(true).reply(200, [])

      const admin = await connectContactsKeycloakAdmin()
      await expect(admin.findUserByUsername('200801011234')).resolves.toBe(null)
    })
  })

  describe('setContactCode', () => {
    it.each([
      ['a user without one', { account_type: ['person'] }],
      [
        'a user with another',
        { account_type: ['person'], contact_code: ['P000001'] },
      ],
    ])(
      'sets contact_code on %s and keeps every other field and attribute',
      async (_, attributes) => {
        let put: Record<string, unknown> | undefined
        expectProvisioningToken()
          .put(`${usersPath}/user-1`, (body) => {
            put = body
            return true
          })
          .reply(204)

        const admin = await connectContactsKeycloakAdmin()
        await admin.setContactCode(
          {
            id: 'user-1',
            username: '200801011234',
            email: 'old@example.com',
            attributes,
          },
          'P123456'
        )

        expect(put).toEqual({
          id: 'user-1',
          username: '200801011234',
          email: 'old@example.com',
          attributes: { account_type: ['person'], contact_code: ['P123456'] },
        })
        expect(nock.isDone()).toBe(true)
      }
    )
  })

  describe('sendSetPasswordEmail', () => {
    it('sends UPDATE_PASSWORD for the mina-sidor client, returning to Mina sidor', async () => {
      let actions: unknown
      expectProvisioningToken()
        .put(`${usersPath}/user-1/execute-actions-email`, (body) => {
          actions = body
          return true
        })
        .query({
          client_id: 'mina-sidor',
          redirect_uri: 'https://mina-sidor.test/',
        })
        .reply(204)

      const admin = await connectContactsKeycloakAdmin()
      await admin.sendSetPasswordEmail('user-1')

      expect(actions).toEqual(['UPDATE_PASSWORD'])
      expect(nock.isDone()).toBe(true)
    })

    it('throws when Keycloak cannot send the e-mail', async () => {
      expectProvisioningToken()
        .put(`${usersPath}/user-1/execute-actions-email`)
        .query(true)
        .reply(500)

      const admin = await connectContactsKeycloakAdmin()
      await expect(admin.sendSetPasswordEmail('user-1')).rejects.toMatchObject({
        response: { status: 500 },
      })
    })
  })
})
