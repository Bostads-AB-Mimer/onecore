import { logger } from '@onecore/utilities'
import type { CreateContactRequestBody } from '@onecore/contacts/schema'

import {
  contactsAdapter,
  type CreateContactError,
} from '../../adapters/contacts-adapter'
import {
  CONTACT_CODE_ATTRIBUTE,
  connectContactsKeycloakAdmin,
  describeKeycloakFailure,
} from '../../services/auth-service/contacts-keycloak-provisioning'
import type {
  RegisterContactRequestBody,
  RegistrationWarning,
} from '../../services/auth-service/contacts-registration-schema'
import { lookupPersonContacts } from './person-contacts-lookup'
import { setUpNewContactProfileAndWaitingLists } from './new-contact-profile-and-waiting-lists'

export type RegisterApplicantError = CreateContactError | 'person-lookup-failed'

export type RegisterApplicantResult =
  | {
      outcome: 'created'
      contactCode: string
      warnings: RegistrationWarning[]
    }
  /** At least one active person contact already has the personnummer. Nothing was changed. */
  | { outcome: 'existing' }
  /**
   * Only inactive contacts have the personnummer, or the duplicate check matched a row that is
   * not a person contact (a company, a deleted contact, a GDPR placeholder). Nothing was
   * changed; kundtjänst has to help.
   */
  | { outcome: 'inactive' }
  /** Nothing was created. */
  | { outcome: 'failed'; error: RegisterApplicantError }

/** Two tries: the first, and one retry. */
const LOGIN_SETUP_ATTEMPTS = 2

/** Keycloak refused the username or e-mail, yet no user has the username: the e-mail is taken. */
class EmailTakenError extends Error {
  readonly name = 'EmailTakenError'
}

type Existing =
  | { outcome: 'none' }
  | { outcome: 'existing' }
  | { outcome: 'inactive' }
  | { outcome: 'failed'; error: 'person-lookup-failed' }

const findExisting = async (nationalId: string): Promise<Existing> => {
  const result = await lookupPersonContacts(nationalId)
  if (!result.ok) {
    logger.error({ err: result.err }, 'registerApplicant.personLookupFailed')
    return { outcome: 'failed', error: 'person-lookup-failed' }
  }
  if (result.data.some((contact) => contact.isActive)) {
    return { outcome: 'existing' }
  }
  return result.data.length > 0 ? { outcome: 'inactive' } : { outcome: 'none' }
}

const toCreateContactBody = (
  application: RegisterContactRequestBody
): CreateContactRequestBody => ({
  nationalId: application.nationalId,
  firstName: application.firstName,
  lastName: application.lastName,
  addresses: [application.address],
  emailAddresses: [
    {
      emailAddress: application.emailAddress,
      type: 'private',
      isPrimary: true,
    },
  ],
  phoneNumbers: application.phoneNumbers,
})

/**
 * Creates the person's login in the mimer-contacts realm and e-mails a new user a link to
 * choose a password. Tried twice; false when both tries fail.
 *
 * A user that already has the username keeps its password and e-mail and only gets a
 * missing contact_code filled in, because the e-mail typed into the form must not be able to
 * take over someone else's login.
 */
const setUpLogin = async (
  username: string,
  email: string,
  contactCode: string
): Promise<boolean> => {
  // Kept across tries, so a retry neither creates the user twice nor skips the e-mail.
  let userId: string | undefined
  let sendEmail = false

  for (let attempt = 1; attempt <= LOGIN_SETUP_ATTEMPTS; attempt++) {
    try {
      const admin = await connectContactsKeycloakAdmin()

      if (!userId) {
        const created = await admin.createPersonUser({
          username,
          email,
          contactCode,
        })
        if (created === 'conflict') {
          const user = await admin.findUserByUsername(username)
          if (!user) throw new EmailTakenError()
          // A user that already carries the contact code created a moment ago is one an
          // earlier try created without seeing the answer, so it still needs its e-mail.
          sendEmail =
            user.attributes?.[CONTACT_CODE_ATTRIBUTE]?.includes(contactCode) ??
            false
          if (!sendEmail) await admin.fillMissingContactCode(user, contactCode)
          userId = user.id
        } else {
          userId = created.id
          sendEmail = true
        }
      }

      if (sendEmail) await admin.sendSetPasswordEmail(userId)
      return true
    } catch (error: unknown) {
      logger.error(
        { contactCode, attempt, ...describeKeycloakFailure(error) },
        'registerApplicant.loginSetupFailed'
      )
      // Retrying cannot free an e-mail address another user holds.
      if (error instanceof EmailTakenError) return false
    }
  }
  return false
}

/**
 * Registers a new applicant: creates the contact, its application profile and queues, and a
 * Keycloak login with a set-password e-mail.
 *
 * Never creates a second contact for a personnummer, and never touches Keycloak for someone
 * who already has a contact.
 *
 * NOT TRANSACTIONAL. The contact is created in Xpand and cannot be removed. Once it exists the
 * result is always 'created', and each later step that fails becomes a warning:
 * - profile and queues are completed by the person under Mina sidor;
 * - a missing login is created by the nightly Keycloak sync, and registering again answers
 *   'existing' rather than creating anything.
 *
 * Never logs the personnummer, the e-mail address or the request.
 *
 * @param application with nationalId already normalised to twelve digits
 */
export const registerApplicant = async (
  application: RegisterContactRequestBody
): Promise<RegisterApplicantResult> => {
  const existing = await findExisting(application.nationalId)
  if (existing.outcome !== 'none') return existing

  const created = await contactsAdapter.createContact(
    toCreateContactBody(application)
  )

  if (!created.ok) {
    if (created.err !== 'duplicate-contact') {
      return { outcome: 'failed', error: created.err }
    }
    // The contacts service matches any row with the number. Either someone registered it
    // in between (a double click, say), or the row is no person contact: a company, a
    // deleted contact or a GDPR placeholder. Its `detail` names the existing contact code,
    // which must never reach the person registering, so it is dropped here.
    const again = await findExisting(application.nationalId)
    return again.outcome === 'none' ? { outcome: 'inactive' } : again
  }

  const { contactCode } = created.data

  // The profile and queues live in ONECore and Xpand, the login in Keycloak; neither
  // depends on the other.
  const [setUp, loginReady] = await Promise.all([
    setUpNewContactProfileAndWaitingLists(contactCode, {
      applicationProfile: application.applicationProfile,
      waitingLists: application.waitingLists,
    }),
    setUpLogin(application.nationalId, application.emailAddress, contactCode),
  ])

  const warnings: RegistrationWarning[] = [
    ...(setUp.applicationProfile.status === 'failed'
      ? (['application-profile-failed'] as const)
      : []),
    ...(setUp.waitingLists.some((outcome) => outcome.status === 'failed')
      ? (['waiting-lists-failed'] as const)
      : []),
    ...(loginReady ? [] : (['login-setup-failed'] as const)),
  ]

  logger.info({ contactCode, warnings }, 'registerApplicant.created')
  return { outcome: 'created', contactCode, warnings }
}
