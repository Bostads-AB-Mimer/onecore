import { logger } from '@onecore/utilities'
import { WaitingListType } from '@onecore/types'

import { contactsAdapter } from '../../../adapters/contacts-adapter'
import {
  connectContactsKeycloakAdmin,
  type ContactsKeycloakAdmin,
} from '../../../services/auth-service/contacts-keycloak-provisioning'
import type { RegisterContactRequestBody } from '../../../services/auth-service/contacts-registration-schema'
import { lookupPersonContacts } from '../person-contacts-lookup'
import {
  type NewContactProfileAndWaitingListsResult,
  setUpNewContactProfileAndWaitingLists,
} from '../new-contact-profile-and-waiting-lists'
import { registerApplicant } from '../register-applicant'

jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('../../../adapters/contacts-adapter', () => ({
  contactsAdapter: { createContact: jest.fn() },
}))

jest.mock('../person-contacts-lookup', () => ({
  lookupPersonContacts: jest.fn(),
}))

jest.mock('../new-contact-profile-and-waiting-lists', () => ({
  setUpNewContactProfileAndWaitingLists: jest.fn(),
}))

jest.mock(
  '../../../services/auth-service/contacts-keycloak-provisioning',
  () => ({
    ...jest.requireActual(
      '../../../services/auth-service/contacts-keycloak-provisioning'
    ),
    connectContactsKeycloakAdmin: jest.fn(),
  })
)

const lookup = lookupPersonContacts as jest.MockedFunction<
  typeof lookupPersonContacts
>
const createContact = contactsAdapter.createContact as jest.MockedFunction<
  typeof contactsAdapter.createContact
>
const setUp = setUpNewContactProfileAndWaitingLists as jest.MockedFunction<
  typeof setUpNewContactProfileAndWaitingLists
>
const connect = connectContactsKeycloakAdmin as jest.MockedFunction<
  typeof connectContactsKeycloakAdmin
>

const nationalId = '200801011234'
const emailAddress = 'kim@example.com'
const contactCode = 'P123456'

const application: RegisterContactRequestBody = {
  nationalId,
  firstName: 'Kim',
  lastName: 'Andersson',
  address: { street: 'Storgatan 1', zipCode: '72211', city: 'Västerås' },
  emailAddress,
  phoneNumbers: [
    { phoneNumber: '0701234567', type: 'mobile', isPrimary: true },
  ],
  waitingLists: [WaitingListType.Housing],
}

const noContacts = { ok: true as const, data: [] }
const activeContact = {
  ok: true as const,
  data: [
    { contactCode: 'P000001', isActive: false },
    { contactCode: 'P000002', isActive: true },
  ],
}
const inactiveContact = {
  ok: true as const,
  data: [{ contactCode: 'P000001', isActive: false }],
}

const setUpResult = (
  overrides: Partial<NewContactProfileAndWaitingListsResult> = {}
): NewContactProfileAndWaitingListsResult => ({
  applicationProfile: { status: 'skipped' },
  waitingLists: [
    { waitingListType: WaitingListType.Housing, status: 'created' },
  ],
  warnings: [],
  ...overrides,
})

const fakeAdmin = (): jest.Mocked<ContactsKeycloakAdmin> => ({
  findUserByUsername: jest.fn().mockResolvedValue(null),
  createPersonUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
  fillMissingContactCode: jest.fn().mockResolvedValue(true),
  sendSetPasswordEmail: jest.fn().mockResolvedValue(undefined),
})

describe('registerApplicant', () => {
  let admin: jest.Mocked<ContactsKeycloakAdmin>

  beforeEach(() => {
    jest.clearAllMocks()
    admin = fakeAdmin()
    connect.mockResolvedValue(admin)
    lookup.mockResolvedValue(noContacts)
    createContact.mockResolvedValue({
      ok: true,
      data: { contactCode, contact: null },
    })
    setUp.mockResolvedValue(setUpResult())
  })

  describe('when the personnummer already has contacts', () => {
    it("answers 'existing' for an active person contact and changes nothing", async () => {
      lookup.mockResolvedValue(activeContact)

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'existing',
      })
      expect(lookup).toHaveBeenCalledWith(nationalId)
      expect(createContact).not.toHaveBeenCalled()
      expect(connect).not.toHaveBeenCalled()
    })

    it("answers 'inactive' when every person contact is inactive", async () => {
      lookup.mockResolvedValue(inactiveContact)

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'inactive',
      })
      expect(createContact).not.toHaveBeenCalled()
      expect(connect).not.toHaveBeenCalled()
    })

    it('fails without creating anything when the lookup fails', async () => {
      lookup.mockResolvedValue({ ok: false, err: 'not-implemented' })

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'failed',
        error: 'person-lookup-failed',
      })
      expect(createContact).not.toHaveBeenCalled()
      expect(connect).not.toHaveBeenCalled()
    })
  })

  describe('when creating the contact', () => {
    it('sends one address, one primary private e-mail and the phone numbers', async () => {
      await registerApplicant(application)

      expect(createContact).toHaveBeenCalledWith({
        nationalId,
        firstName: 'Kim',
        lastName: 'Andersson',
        addresses: [application.address],
        emailAddresses: [{ emailAddress, type: 'private', isPrimary: true }],
        phoneNumbers: application.phoneNumbers,
      })
    })

    it('passes a create failure through and does nothing more', async () => {
      createContact.mockResolvedValue({
        ok: false,
        err: 'xpand-unavailable',
        statusCode: 503,
      })

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'failed',
        error: 'xpand-unavailable',
      })
      expect(setUp).not.toHaveBeenCalled()
      expect(connect).not.toHaveBeenCalled()
    })

    it("answers 'existing' when the duplicate check fires because someone registered in between", async () => {
      lookup
        .mockResolvedValueOnce(noContacts)
        .mockResolvedValueOnce(activeContact)
      createContact.mockResolvedValue({
        ok: false,
        err: 'duplicate-contact',
        statusCode: 409,
        detail: 'P000002',
      })

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'existing',
      })
      expect(lookup).toHaveBeenCalledTimes(2)
      expect(connect).not.toHaveBeenCalled()
    })

    it("answers 'inactive' when the duplicate check matches a row that is no person contact", async () => {
      lookup.mockResolvedValue(noContacts)
      createContact.mockResolvedValue({
        ok: false,
        err: 'duplicate-contact',
        statusCode: 409,
        detail: 'F000001',
      })

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'inactive',
      })
      expect(lookup).toHaveBeenCalledTimes(2)
      expect(connect).not.toHaveBeenCalled()
    })
  })

  describe('after the contact is created', () => {
    it('sets up profile and queues, creates the login and sends the e-mail', async () => {
      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'created',
        contactCode,
        warnings: [],
      })

      expect(setUp).toHaveBeenCalledWith(contactCode, {
        applicationProfile: undefined,
        waitingLists: [WaitingListType.Housing],
      })
      expect(admin.createPersonUser).toHaveBeenCalledWith({
        username: nationalId,
        email: emailAddress,
        contactCode,
      })
      expect(admin.sendSetPasswordEmail).toHaveBeenCalledWith('user-1')
    })

    it('reports a failed profile and failed queues as warnings', async () => {
      setUp.mockResolvedValue(
        setUpResult({
          applicationProfile: { status: 'failed', error: 'unknown' },
          waitingLists: [
            { waitingListType: WaitingListType.Housing, status: 'failed' },
            { waitingListType: WaitingListType.Storage, status: 'created' },
          ],
        })
      )

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'created',
        contactCode,
        warnings: ['application-profile-failed', 'waiting-lists-failed'],
      })
    })
  })

  describe('setting up the login', () => {
    it('only fills in contact_code on a user that already has the username, and sends no e-mail', async () => {
      const user = { id: 'user-9', username: nationalId }
      admin.createPersonUser.mockResolvedValue('conflict')
      admin.findUserByUsername.mockResolvedValue(user)

      await expect(registerApplicant(application)).resolves.toMatchObject({
        outcome: 'created',
        warnings: [],
      })
      expect(admin.fillMissingContactCode).toHaveBeenCalledWith(
        user,
        contactCode
      )
      expect(admin.sendSetPasswordEmail).not.toHaveBeenCalled()
    })

    it('still sends the e-mail when the existing user is the one an earlier try created', async () => {
      admin.createPersonUser
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('conflict')
      admin.findUserByUsername.mockResolvedValue({
        id: 'user-1',
        username: nationalId,
        attributes: { contact_code: [contactCode] },
      })

      await expect(registerApplicant(application)).resolves.toMatchObject({
        warnings: [],
      })
      expect(admin.fillMissingContactCode).not.toHaveBeenCalled()
      expect(admin.sendSetPasswordEmail).toHaveBeenCalledWith('user-1')
    })

    it('retries the e-mail without creating the user again', async () => {
      admin.sendSetPasswordEmail
        .mockRejectedValueOnce(new Error('smtp down'))
        .mockResolvedValueOnce(undefined)

      await expect(registerApplicant(application)).resolves.toMatchObject({
        warnings: [],
      })
      expect(admin.createPersonUser).toHaveBeenCalledTimes(1)
      expect(admin.sendSetPasswordEmail).toHaveBeenCalledTimes(2)
    })

    it("warns 'login-setup-failed' after the retry fails too", async () => {
      admin.sendSetPasswordEmail.mockRejectedValue(new Error('smtp down'))

      await expect(registerApplicant(application)).resolves.toEqual({
        outcome: 'created',
        contactCode,
        warnings: ['login-setup-failed'],
      })
      expect(admin.sendSetPasswordEmail).toHaveBeenCalledTimes(2)
    })

    it("warns 'login-setup-failed' when Keycloak cannot be reached at all", async () => {
      connect.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(registerApplicant(application)).resolves.toMatchObject({
        outcome: 'created',
        warnings: ['login-setup-failed'],
      })
      expect(connect).toHaveBeenCalledTimes(2)
    })

    it('does not retry when another user holds the e-mail address', async () => {
      admin.createPersonUser.mockResolvedValue('conflict')
      admin.findUserByUsername.mockResolvedValue(null)

      await expect(registerApplicant(application)).resolves.toMatchObject({
        warnings: ['login-setup-failed'],
      })
      expect(admin.createPersonUser).toHaveBeenCalledTimes(1)
    })
  })

  it('never logs the personnummer or the e-mail address', async () => {
    admin.sendSetPasswordEmail.mockRejectedValue(new Error('smtp down'))
    setUp.mockResolvedValue(
      setUpResult({ applicationProfile: { status: 'failed' } })
    )

    await registerApplicant(application)
    lookup.mockResolvedValue({ ok: false, err: 'contacts-service-error' })
    await registerApplicant(application)

    const logged = JSON.stringify([
      ...(logger.info as jest.Mock).mock.calls,
      ...(logger.warn as jest.Mock).mock.calls,
      ...(logger.error as jest.Mock).mock.calls,
    ])
    expect(logged).not.toContain(nationalId)
    expect(logged).not.toContain(emailAddress)
  })
})
