import { logger } from '@onecore/utilities'
import z from 'zod'

import { ContactsRepository } from '@src/adapters/contact-adapter'
import { ContactWriter } from '@src/adapters/contact-writer'
import { AdapterResult } from '@src/adapters/types'
import { Contact } from '@src/domain/contact'
import { getAgeFromNationalId, parseNationalId } from '@src/domain/national-id'
import { generateInitialPassword } from './password'
import {
  CreateContactErrorCodeSchema,
  CreateContactRequestBodySchema,
} from './schema'

export type CreateContactRequest = z.infer<
  typeof CreateContactRequestBodySchema
>
export type CreateContactError = z.infer<typeof CreateContactErrorCodeSchema>

export type CreateContactResult = {
  contactCode: string
  /** Read back immediately after creation; null when that read did not resolve. */
  contact: Contact | null
}

/**
 * Minimum age for a contact we provision a web account for.
 *
 * Mirrors the public registration flow, which refuses applicants under 16.
 */
const MINIMUM_AGE = 16

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

  const age = getAgeFromNationalId(request.nationalId)
  if (age !== null && age < MINIMUM_AGE) {
    return {
      ok: false,
      err: 'invalid-national-id',
      detail: `Kunden måste vara minst ${MINIMUM_AGE} år.`,
    }
  }

  const existing = await contactsRepository.existsByNationalIdNumber(
    forms.twelveDigits
  )

  if (existing) {
    return { ok: false, err: 'duplicate-contact', detail: existing }
  }

  const primaryEmail =
    request.emailAddresses.find((email) => email.isPrimary) ??
    request.emailAddresses[0]

  const created = await contactWriter.createContact({
    nationalId: forms.twelveDigits,
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
      name: forms.twelveDigits,
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

  // A malformed response is the one failure where the contact may well exist —
  // we simply could not read its code. Recovering it turns the worst outcome
  // into a normal success. Retrying instead would either duplicate the contact
  // or be blocked by the duplicate check above, so it must not be left to the
  // caller.
  if (created.err === 'xpand-malformed-response') {
    const recovered = await contactWriter.findContactCodeByNationalId(
      forms.twelveDigits
    )

    if (recovered.ok && recovered.data.contactCode) {
      logger.warn(
        { contactCode: recovered.data.contactCode },
        'createContact.recoveredContactCodeAfterMalformedResponse'
      )

      return {
        ok: true,
        data: {
          contactCode: recovered.data.contactCode,
          contact: await readBack(
            contactsRepository,
            recovered.data.contactCode
          ),
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
