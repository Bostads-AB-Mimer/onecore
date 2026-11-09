import {
  Lease,
  LeaseTerminationConfirmationEmail,
  LeaseTerminationConfirmationRequest,
  LeaseTerminationRentalType,
  LeaseTerminationTenant,
  LeaseType,
} from '@onecore/types'
import type { Contact } from '@onecore/contacts/schema'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import * as communicationAdapter from '../../../adapters/communication-adapter'
import { contactsAdapter } from '../../../adapters/contacts-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import {
  hashNotificationPayload,
  IdempotencyStore,
  tenantNotificationIdempotencyStore,
} from './idempotency'
import { SendLeaseTerminationConfirmationErrorCodes } from './schema'

/** The integration's request plus server-set audit attribution. */
export type LeaseTerminationNotification =
  LeaseTerminationConfirmationRequest & { triggeredByUser?: string }

// The route's 400s (missing key, invalid body) are decided before this runs.
export type SendLeaseTerminationConfirmationError = z.infer<
  (typeof SendLeaseTerminationConfirmationErrorCodes)[404 | 409 | 422 | 502]
>

export type SendLeaseTerminationConfirmationResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: SendLeaseTerminationConfirmationError }

type Recipient = {
  contact: Contact
  emailAddress: string
}

const toDateString = (value: Date | string | undefined): string | undefined =>
  value ? new Date(value).toISOString().slice(0, 10) : undefined

const primaryEmail = (contact: Contact): string | undefined => {
  const emails = contact.communication.emailAddresses
  return (emails.find((e) => e.isPrimary) ?? emails[0])?.emailAddress
}

const nameOf = (contact: Contact) =>
  contact.type === 'individual'
    ? {
        firstName: contact.personal.firstName || contact.personal.fullName,
        lastName: contact.personal.lastName ?? '',
        fullName: contact.personal.fullName,
      }
    : // An organisation holder has no personal name; greet it by its name.
      {
        firstName: contact.organisation.name,
        lastName: '',
        fullName: contact.organisation.name,
      }

export const toLeaseTerminationTenant = (
  contact: Contact
): LeaseTerminationTenant => {
  // Contacts returns only the invoice address (adrfakt); first is the one.
  const address = contact.addresses[0]
  const birthDate =
    contact.type === 'individual' ? contact.personal.birthDate : null

  return {
    contactCode: contact.contactCode,
    fullName: nameOf(contact).fullName,
    // Birth date only — never the full personnummer (the email is sent in
    // clear text and kept in the communication log). Xpand returns a
    // datetime; keep the date part. 'redacted' or junk → empty.
    birthDate:
      birthDate && /^\d{4}-\d{2}-\d{2}/.test(birthDate)
        ? birthDate.slice(0, 10)
        : '',
    street: address?.street ?? '',
    zipCode: address?.zipCode ?? '',
    city: address?.city ?? '',
  }
}

type LeaseFacts = {
  contactCodes: string[]
  endDate: Date
  rentalType: LeaseTerminationRentalType
  preferredMoveOutDate: string | undefined
  rentalObjectAddress: string | undefined
}

// Only parking space contracts are supported (see LeaseTerminationRentalType).
const resolveRentalType = (
  lease: Lease
): LeaseTerminationRentalType | undefined =>
  lease.type?.trim() === LeaseType.ParkingSpaceContract ? 'Bilplats' : undefined

// Everything in the email comes from the lease — never from the request.
const getLeaseFacts = async (
  leaseId: string
): Promise<
  | { ok: true; data: LeaseFacts }
  | {
      ok: false
      error:
        | 'lease-not-found'
        | 'lease-lookup-failed'
        | 'missing-end-date'
        | 'unsupported-rental-type'
    }
> => {
  let lease: Lease | null
  try {
    lease = await leasingAdapter.getLease(leaseId)
  } catch (err: unknown) {
    logger.error(
      {
        leaseId,
        error: err instanceof Error ? err.message : String(err),
      },
      'sendLeaseTerminationConfirmation: lease lookup failed'
    )
    return { ok: false, error: 'lease-lookup-failed' }
  }

  if (!lease) {
    return { ok: false, error: 'lease-not-found' }
  }

  // JSON from the leasing service: dates arrive as strings despite the type.
  const leaseEndDate = toDateString(lease.leaseEndDate)
  if (!leaseEndDate) {
    return { ok: false, error: 'missing-end-date' }
  }
  const endDate = new Date(`${leaseEndDate}T00:00:00.000Z`)

  const rentalType = resolveRentalType(lease)
  if (!rentalType) {
    return { ok: false, error: 'unsupported-rental-type' }
  }

  // Every holder on the lease gets the confirmation.
  const contactCodes = [
    ...new Set(
      (lease.tenantContactIds ?? [])
        .map((code) => code.trim())
        .filter((code) => code.length > 0)
    ),
  ]

  return {
    ok: true,
    data: {
      contactCodes,
      endDate,
      rentalType,
      preferredMoveOutDate: toDateString(lease.preferredMoveOutDate),
      rentalObjectAddress: lease.rentalObject?.address?.trim() || undefined,
    },
  }
}

// Contact data comes from the contacts service only, and the path fails
// closed: if any holder cannot be resolved we send nothing.
const getHolders = async (
  contactCodes: string[],
  leaseId: string
): Promise<
  | { ok: true; data: Contact[] }
  | { ok: false; error: 'contact-lookup-failed' | 'contact-not-found' }
> => {
  const result = await contactsAdapter
    .getByContactCodeBatch(contactCodes, {
      includeEmail: true,
      includeAddress: true,
    })
    .catch((err: unknown) => {
      logger.error(
        { leaseId, error: err instanceof Error ? err.message : String(err) },
        'sendLeaseTerminationConfirmation: contacts lookup threw'
      )
      return null
    })

  if (!result) return { ok: false, error: 'contact-lookup-failed' }

  if (!result.ok) {
    logger.error(
      { leaseId, err: result.err, statusCode: result.statusCode },
      'sendLeaseTerminationConfirmation: contacts lookup failed'
    )
    return { ok: false, error: 'contact-lookup-failed' }
  }

  const byCode = new Map(result.data.map((c) => [c.contactCode.trim(), c]))
  const missing = contactCodes.filter((code) => !byCode.has(code))
  if (missing.length > 0) {
    // The lease names these holders, so they are expected to exist. This is a
    // data problem, not an outage: a retry will not help, so report it apart
    // from contact-lookup-failed.
    logger.error(
      { leaseId, missing },
      'sendLeaseTerminationConfirmation: lease holders missing in contacts'
    )
    return { ok: false, error: 'contact-not-found' }
  }

  // Keep lease order so both holders' emails list them identically.
  return {
    ok: true,
    data: contactCodes.map((code) => byCode.get(code) as Contact), // every code checked above
  }
}

// Per-recipient key, so a retry after a partial failure only resends to the
// holders whose email did not go out.
const recipientKey = (idempotencyKey: string, contactCode: string) =>
  `${idempotencyKey}#${contactCode}`

export const sendLeaseTerminationConfirmation = async (
  notification: LeaseTerminationNotification,
  idempotencyKey: string,
  store: IdempotencyStore = tenantNotificationIdempotencyStore
): Promise<SendLeaseTerminationConfirmationResult> => {
  const payloadHash = hashNotificationPayload(notification)
  const claim = store.claim(idempotencyKey, payloadHash)

  if (claim === 'conflict') {
    return { ok: false, error: 'idempotency-conflict' }
  }

  if (claim === 'duplicate' || claim === 'in-flight') {
    return { ok: true, duplicate: true }
  }

  const fail = (error: SendLeaseTerminationConfirmationError) => {
    store.release(idempotencyKey, payloadHash)
    return { ok: false as const, error }
  }

  const leaseFacts = await getLeaseFacts(notification.leaseId)
  if (!leaseFacts.ok) return fail(leaseFacts.error)

  const holders = await getHolders(
    leaseFacts.data.contactCodes,
    notification.leaseId
  )
  if (!holders.ok) return fail(holders.error)

  const recipients: Recipient[] = []
  for (const contact of holders.data) {
    const emailAddress = primaryEmail(contact)
    if (emailAddress) {
      recipients.push({ contact, emailAddress })
    } else {
      logger.warn(
        { leaseId: notification.leaseId, contactCode: contact.contactCode },
        'sendLeaseTerminationConfirmation: lease holder has no email address, skipping'
      )
    }
  }

  if (recipients.length === 0) return fail('no-recipient')

  const tenants = holders.data.map(toLeaseTerminationTenant)

  const results = await Promise.all(
    recipients.map(async ({ contact, emailAddress }) => {
      const key = recipientKey(idempotencyKey, contact.contactCode)
      const claim = store.claim(key, payloadHash)
      // Already sent on an earlier, partially failed attempt.
      if (claim === 'duplicate') return true
      if (claim !== 'claimed') {
        // 'conflict' or 'in-flight': we cannot tell whether this holder got
        // the email, so never report it as sent.
        logger.error(
          {
            leaseId: notification.leaseId,
            contactCode: contact.contactCode,
            claim,
          },
          'sendLeaseTerminationConfirmation: recipient key not claimable'
        )
        return false
      }

      const { firstName, lastName } = nameOf(contact)
      const email: LeaseTerminationConfirmationEmail = {
        to: emailAddress,
        contactCode: contact.contactCode,
        firstName,
        lastName,
        leaseId: notification.leaseId,
        endDate: leaseFacts.data.endDate,
        rentalType: leaseFacts.data.rentalType,
        correlationId: notification.correlationId,
        triggeredByUser: notification.triggeredByUser,
        preferredMoveOutDate: leaseFacts.data.preferredMoveOutDate,
        rentalObjectAddress: leaseFacts.data.rentalObjectAddress,
        tenants,
      }

      const result =
        await communicationAdapter.sendLeaseTerminationConfirmationEmail(email)

      if (result.ok) {
        store.markSucceeded(key, payloadHash)
      } else {
        store.release(key, payloadHash)
      }
      return result.ok
    })
  )

  if (results.some((ok) => !ok)) return fail('send-failed')

  store.markSucceeded(idempotencyKey, payloadHash)
  return { ok: true, duplicate: false }
}
