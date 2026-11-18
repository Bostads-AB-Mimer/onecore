import { logger } from '@onecore/utilities'
import z from 'zod'

import { ContactsRepository } from '@src/adapters/contact-adapter'
import { ContactWriter } from '@src/adapters/contact-writer'
import { AdapterResult } from '@src/adapters/types'
import { createKeyedLock } from '@src/common/keyed-lock'
import { isOldEnough, MINIMUM_AGE } from '@src/domain/age-rule'
import { Contact } from '@src/domain/contact'
import { parseNationalId } from '@src/domain/national-id'
import { generateInitialPassword } from './password'
import {
  CreateContactAgeRuleSchema,
  CreateContactErrorCodeSchema,
  CreateContactRequestBodySchema,
} from './schema'

export type CreateContactRequest = z.infer<
  typeof CreateContactRequestBodySchema
>
export type CreateContactError = z.infer<typeof CreateContactErrorCodeSchema>
export type CreateContactAgeRule = z.infer<typeof CreateContactAgeRuleSchema>

export type CreateContactResult = {
  contactCode: string
  /** Read back immediately after creation; null when that read did not resolve. */
  contact: Contact | null
}

/**
 * Serialises creates per national ID, from the duplicate check to the end of
 * the write. Without it two requests for one number (a double click, a retry
 * from webapi, a caseworker and the person at once) both pass the duplicate
 * check while Xpand's slow SOAP create is still running, and both create a
 * contact.
 *
 * In-process only, which covers every create because the contacts service runs
 * as a single replica. Running more replicas needs a lock they share.
 */
const withNationalIdLock = createKeyedLock()

export type CreateContactDependencies = {
  contactsRepository: ContactsRepository
  contactWriter: ContactWriter
}

/**
 * Creates a contact in the system of record.
 *
 * The single most important property of this function is that it refuses to
 * create a contact whose national ID already exists. Creation cannot be undone
 * from here, the upstream system does not reject duplicates on its own, and
 * roughly 4 400 duplicated identity numbers already sit in the data — so this
 * check is a safety mechanism, not a convenience.
 */
export const createContact = async (
  { contactsRepository, contactWriter }: CreateContactDependencies,
  request: CreateContactRequest
): Promise<AdapterResult<CreateContactResult, CreateContactError>> => {
  const forms = parseNationalId(request.nationalId)

  if (!forms) {
    return {
      ok: false,
      err: 'invalid-national-id',
      detail: 'Personnumret är inte giltigt.',
    }
  }

  const ageRule = request.ageRule ?? 'exact-age'
  if (!isOldEnough(forms.twelveDigits, ageRule, new Date())) {
    return {
      ok: false,
      err: 'invalid-national-id',
      detail:
        ageRule === 'birth-year'
          ? `Kunden måste fylla minst ${MINIMUM_AGE} år i år.`
          : `Kunden måste vara minst ${MINIMUM_AGE} år.`,
    }
  }

  return withNationalIdLock(forms.twelveDigits, () =>
    createUnlessDuplicate(
      { contactsRepository, contactWriter },
      request,
      forms.twelveDigits
    )
  )
}

/**
 * The duplicate check and the write. Must only run under the national ID's
 * lock, so a second request for the number sees the first one's contact.
 */
const createUnlessDuplicate = async (
  { contactsRepository, contactWriter }: CreateContactDependencies,
  request: CreateContactRequest,
  twelveDigits: string
): Promise<AdapterResult<CreateContactResult, CreateContactError>> => {
  const existing =
    await contactsRepository.existsByNationalIdNumber(twelveDigits)

  if (existing) {
    return { ok: false, err: 'duplicate-contact', detail: existing }
  }

  const primaryEmail =
    request.emailAddresses.find((email) => email.isPrimary) ??
    request.emailAddresses[0]

  const created = await contactWriter.createContact({
    nationalId: twelveDigits,
    firstName: request.firstName,
    lastName: request.lastName,
    addresses: request.addresses,
    emailAddresses: request.emailAddresses.map((email) => ({
      emailAddress: email.emailAddress,
      isPrimary: email.isPrimary,
    })),
    phoneNumbers: request.phoneNumbers,
    credentials: {
      // The upstream convention: the web account's username is the identity
      // number, matching how the public site registers applicants.
      name: twelveDigits,
      email: primaryEmail.emailAddress,
      password: generateInitialPassword(),
    },
  })

  if (created.ok) {
    return {
      ok: true,
      data: {
        contactCode: created.data.contactCode,
        contact: await readBack(contactsRepository, created.data.contactCode),
      },
    }
  }

  // Two failures are ambiguous: a malformed response (the call went through
  // but its code was unreadable) and a transport failure (a timeout may have
  // struck after Xpand committed). In both the contact may well exist, so the
  // code is recovered with the same lookup the duplicate check used — Xpand's
  // database shows the new row immediately. Retrying instead would either
  // duplicate the contact or be blocked by that check, so recovery must not be
  // left to the caller.
  if (
    created.err === 'xpand-malformed-response' ||
    created.err === 'xpand-unavailable'
  ) {
    const recovered =
      await contactsRepository.existsByNationalIdNumber(twelveDigits)

    if (recovered) {
      logger.warn(
        { contactCode: recovered, err: created.err },
        'createContact.recoveredContactCodeAfterAmbiguousFailure'
      )

      return {
        ok: true,
        data: {
          contactCode: recovered,
          contact: await readBack(contactsRepository, recovered),
        },
      }
    }
  }

  return { ok: false, err: created.err, detail: created.detail }
}

/**
 * Best-effort read of the contact we just created.
 *
 * Never fails the operation: the contact exists regardless, and `contactCode`
 * is what callers actually need. A failure here means the response is less
 * useful, not that anything went wrong upstream.
 */
const readBack = async (
  contactsRepository: ContactsRepository,
  contactCode: string
): Promise<Contact | null> => {
  try {
    return await contactsRepository.getByContactCode(contactCode)
  } catch (err) {
    logger.error({ err, contactCode }, 'createContact.readBackFailed')
    return null
  }
}
