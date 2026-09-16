import { logger } from '@onecore/utilities'
import z from 'zod'

import { ContactsRepository } from '@src/adapters/contact-adapter'
import { ContactWriter, ContactWriterParty } from '@src/adapters/contact-writer'
import {
  ContactCategoryWriter,
  convertedContactCode,
} from '@src/adapters/contact-category-writer'
import { AdapterResult } from '@src/adapters/types'
import { Contact, ContactCategory } from '@src/domain/contact'
import {
  getAgeFromNationalId,
  NationalIdForms,
  parseNationalId,
} from '@src/domain/national-id'
import { parseOrganisationNumber } from '@src/domain/organisation-number'
import { generateInitialPassword } from './password'
import {
  CreateContactConversionSchema,
  CreateContactErrorCodeSchema,
  CreateContactRequestBodySchema,
} from './schema'

export type CreateContactRequest = z.infer<
  typeof CreateContactRequestBodySchema
>
export type CreateContactError = z.infer<typeof CreateContactErrorCodeSchema>
export type CreateContactConversion = z.infer<
  typeof CreateContactConversionSchema
>

export type CreateContactResult = {
  contactCode: string
  /** Read back immediately after creation; null when that read did not resolve. */
  contact: Contact | null
  conversion: CreateContactConversion
}

/**
 * Minimum age for a contact we provision a web account for.
 *
 * Mirrors the public registration flow, which refuses applicants under 16.
 */
const MINIMUM_AGE = 16

/**
 * How many times the category conversion is attempted before the contact is
 * returned as a person with `conversion.status = 'failed'`.
 *
 * The conversion is a single idempotent UPDATE, so retrying is safe — unlike
 * the SOAP create that precedes it. Three quick attempts cover a dropped
 * connection or a momentary lock without holding the caseworker's request
 * for long; anything more persistent is reported instead.
 */
const DEFAULT_CONVERSION_RETRY = { attempts: 3, delayMs: 250 }

export type CreateContactDependencies = {
  contactsRepository: ContactsRepository
  contactWriter: ContactWriter
  contactCategoryWriter: ContactCategoryWriter
  /** Overridable for tests, which should not wait on real backoff. */
  conversionRetry?: { attempts: number; delayMs: number }
}

/**
 * Creates a contact in the system of record.
 *
 * The single most important property of this function is that it refuses to
 * create a contact whose identity number already exists. Creation cannot be
 * undone from here, the upstream system does not reject duplicates on its own,
 * and roughly 4 400 duplicated identity numbers already sit in the data — so
 * this check is a safety mechanism, not a convenience.
 *
 * An organisation is created the only way the upstream system allows — as a
 * natural person — and then converted to its category. Once the create has
 * succeeded the result is always `ok`: a failed conversion is reported under
 * `conversion`, never as an error, because an error would invite a retry that
 * the duplicate check must then block.
 */
export const createContact = async (
  dependencies: CreateContactDependencies,
  request: CreateContactRequest
): Promise<AdapterResult<CreateContactResult, CreateContactError>> => {
  const { contactsRepository, contactWriter } = dependencies

  const identity = resolveIdentity(request)
  if (!identity.ok) return identity

  const { forms, party, username } = identity.data

  const existing = await contactsRepository.existsByIdentityForms(forms)

  if (existing) {
    return { ok: false, err: 'duplicate-contact', detail: existing }
  }

  const primaryEmail =
    request.emailAddresses.find((email) => email.isPrimary) ??
    request.emailAddresses[0]

  const created = await contactWriter.createContact({
    party,
    addresses: request.addresses,
    emailAddresses: request.emailAddresses.map((email) => ({
      emailAddress: email.emailAddress,
      isPrimary: email.isPrimary,
    })),
    phoneNumbers: request.phoneNumbers,
    credentials: {
      name: username,
      email: primaryEmail.emailAddress,
      password: generateInitialPassword(),
    },
  })

  if (created.ok) {
    return complete(dependencies, request, created.data.contactCode)
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
    const recovered = await contactsRepository.existsByIdentityForms(forms)

    if (recovered) {
      logger.warn(
        { contactCode: recovered, err: created.err },
        'createContact.recoveredContactCodeAfterAmbiguousFailure'
      )

      return complete(dependencies, request, recovered)
    }
  }

  return { ok: false, err: created.err, detail: created.detail }
}

type ResolvedIdentity = {
  forms: NationalIdForms
  party: ContactWriterParty
  /**
   * The web account's username. The upstream convention — mirrored from how
   * the public site registers applicants — is that the username *is* the
   * identity number: twelve digits for a person, the ten-digit organisation
   * number for an organisation.
   */
  username: string
}

/**
 * Validates the identity number of the request and shapes the party for the
 * writer. This is where the two kinds of contact differ most: what counts as
 * a valid number, whether an age applies, and which fields carry the name.
 */
const resolveIdentity = (
  request: CreateContactRequest
): AdapterResult<ResolvedIdentity, CreateContactError> => {
  if (request.type === 'organisation') {
    const forms = parseOrganisationNumber(request.organisationNumber)

    if (!forms) {
      return {
        ok: false,
        err: 'invalid-organisation-number',
        detail: 'Organisationsnumret är inte giltigt.',
      }
    }

    return {
      ok: true,
      data: {
        forms,
        party: {
          kind: 'organisation',
          organisationNumber: forms.tenDigits,
          name: request.name,
        },
        username: forms.tenDigits,
      },
    }
  }

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

  return {
    ok: true,
    data: {
      forms,
      party: {
        kind: 'person',
        nationalId: forms.twelveDigits,
        firstName: request.firstName,
        lastName: request.lastName,
      },
      username: forms.twelveDigits,
    },
  }
}

/**
 * Everything that happens once the contact exists: category conversion for an
 * organisation, then the read-back. Always resolves to `ok` — see
 * `createContact`.
 */
const complete = async (
  dependencies: CreateContactDependencies,
  request: CreateContactRequest,
  contactCode: string
): Promise<AdapterResult<CreateContactResult, CreateContactError>> => {
  const conversion =
    request.type === 'organisation'
      ? await convertWithRetry(dependencies, contactCode, request)
      : { status: 'not-applicable' as const, contactCode }

  return {
    ok: true,
    data: {
      contactCode: conversion.contactCode,
      contact: await readBack(
        dependencies.contactsRepository,
        conversion.contactCode
      ),
      conversion: {
        status: conversion.status,
        ...(conversion.error ? { error: conversion.error } : {}),
      },
    },
  }
}

type ConversionOutcome = CreateContactConversion & { contactCode: string }

/**
 * Converts the created person into an organisation, retrying on transient
 * failures.
 *
 * The contact may arrive here by recovery rather than by a clean create, in
 * which case a previous attempt may already have converted it: a code that no
 * longer starts with P, or an `already-converted` answer, both count as done.
 */
const convertWithRetry = async (
  dependencies: CreateContactDependencies,
  contactCode: string,
  organisation: { category: ContactCategory; name: string }
): Promise<ConversionOutcome> => {
  const { contactCategoryWriter } = dependencies
  const { attempts, delayMs } =
    dependencies.conversionRetry ?? DEFAULT_CONVERSION_RETRY
  const { category, name } = organisation

  const targetCode = convertedContactCode(contactCode, category)
  if (!targetCode) {
    return { status: 'done', contactCode }
  }

  let error: string = 'xpand-db-error'

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await contactCategoryWriter.convertToOrganisation({
      contactCode,
      category,
      name,
    })

    if (result.ok) {
      return { status: 'done', contactCode: result.data.contactCode }
    }

    if (result.err === 'already-converted') {
      return { status: 'done', contactCode: targetCode }
    }

    error = result.err

    // Only a database failure can come out differently on a second attempt.
    // A missing row or an unknown category answers the same every time.
    if (result.err !== 'xpand-db-error') break

    if (attempt < attempts) await sleep(delayMs)
  }

  logger.error(
    { contactCode, targetCode, category, err: error },
    'createContact.conversionFailed'
  )

  return { status: 'failed', contactCode, error }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

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
