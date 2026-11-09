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
import axios from 'axios'
import { z } from 'zod'

import * as communicationAdapter from '../../../adapters/communication-adapter'
import { contactsAdapter } from '../../../adapters/contacts-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import {
  DeliverySummary,
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
  | { ok: true; duplicate: boolean; summary: DeliverySummary }
  | { ok: false; error: SendLeaseTerminationConfirmationError }

type Recipient = {
  contact: Contact
  emailAddress: string
}

// `{ status, error }` for the log — never the raw AxiosError (AGENTS.md).
const errorLogFields = (err: unknown) => ({
  status: axios.isAxiosError(err) ? err.response?.status : undefined,
  error: err instanceof Error ? err.message : String(err),
})

// sv-SE formats as YYYY-MM-DD. Lease dates are Swedish calendar dates: a
// Tenfast date at Swedish midnight arrives as 23:00Z the day before, so
// formatting in UTC (toISOString) would shift it back one day.
const swedishDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
})

export const toSwedishDateString = (
  value: Date | string | null | undefined
): string | undefined => {
  if (!value) return undefined
  const date = new Date(value)
  // An unparseable date is treated as missing rather than thrown.
  return Number.isNaN(date.getTime())
    ? undefined
    : swedishDateFormatter.format(date)
}

const EmailAddressSchema = z.string().trim().email()

// Primary address first, then the others. Xpand emails can be padded or junk
// ('-', 'saknas'); the communication service rejects those with a 400 that a
// retry would never fix, so an invalid address counts as no address.
export const deliverableEmail = (contact: Contact): string | undefined => {
  const emails = [...contact.communication.emailAddresses].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
  )
  for (const { emailAddress } of emails) {
    const parsed = EmailAddressSchema.safeParse(emailAddress)
    if (parsed.success) return parsed.data
  }
  return undefined
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

// Parking spaces and garages both count as 'Bilplats' in this flow.
const BILPLATS_LEASE_TYPES: string[] = [
  LeaseType.ParkingSpaceContract,
  LeaseType.GarageContract,
]

const resolveRentalType = (
  lease: Lease
): LeaseTerminationRentalType | undefined =>
  BILPLATS_LEASE_TYPES.includes(lease.type?.trim() ?? '')
    ? 'Bilplats'
    : undefined

// Xpand codes are space-padded and compared case-insensitively in SQL; the
// lease (Tenfast externalId) and contacts may differ in both.
const normalizeContactCode = (code: string) => code.trim().toUpperCase()

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
      { leaseId, ...errorLogFields(err) },
      'sendLeaseTerminationConfirmation: lease lookup failed'
    )
    return { ok: false, error: 'lease-lookup-failed' }
  }

  if (!lease) {
    return { ok: false, error: 'lease-not-found' }
  }

  // JSON from the leasing service: dates arrive as strings despite the type.
  const leaseEndDate = toSwedishDateString(lease.leaseEndDate)
  if (!leaseEndDate) {
    // The end date is set at preliminary termination, before Tenfast
    // confirms and calls us, so a missing one is unexpected.
    logger.error(
      { leaseId },
      'sendLeaseTerminationConfirmation: lease has no end date'
    )
    return { ok: false, error: 'missing-end-date' }
  }
  const endDate = new Date(`${leaseEndDate}T00:00:00.000Z`)

  const rentalType = resolveRentalType(lease)
  if (!rentalType) {
    // Tenfast only calls for parking terminations, so this is unexpected too.
    logger.error(
      { leaseId, leaseType: lease.type },
      'sendLeaseTerminationConfirmation: unsupported lease type'
    )
    return { ok: false, error: 'unsupported-rental-type' }
  }

  // Every holder on the lease gets the confirmation.
  const contactCodes = [
    ...new Set(
      (lease.tenantContactIds ?? [])
        .map(normalizeContactCode)
        .filter((code) => code.length > 0)
    ),
  ]

  return {
    ok: true,
    data: {
      contactCodes,
      endDate,
      rentalType,
      preferredMoveOutDate: toSwedishDateString(lease.preferredMoveOutDate),
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
        { leaseId, ...errorLogFields(err) },
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

  const byCode = new Map(
    result.data.map((c) => [normalizeContactCode(c.contactCode), c])
  )
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

  // Keep lease order so both holders' emails list them identically. Use the
  // normalized code: it ends up in the per-recipient idempotency key and the
  // communication log, so it must be the same however the source spelled it.
  return {
    ok: true,
    data: contactCodes.map((code) => ({
      ...(byCode.get(code) as Contact), // every code checked above
      contactCode: code,
    })),
  }
}

// Request and per-recipient records share one store, so each gets its own
// prefix and the caller's key is encoded: no Idempotency-Key can ever equal a
// recipient key. The per-recipient key lets a retry after a partial failure
// resend only to the holders whose email did not go out.
const requestKey = (idempotencyKey: string) =>
  `request:${encodeURIComponent(idempotencyKey)}`
const recipientKey = (idempotencyKey: string, contactCode: string) =>
  `recipient:${encodeURIComponent(idempotencyKey)}:${encodeURIComponent(contactCode)}`

type SendOutcome =
  | { ok: true; summary: DeliverySummary }
  | {
      ok: false
      error: Exclude<
        SendLeaseTerminationConfirmationError,
        'idempotency-conflict' | 'request-in-progress'
      >
    }

// Sends one email to one holder under its own idempotency key. The key is
// released on any outcome but success — including a throw — so it can never be
// left in-flight and block the holder on later retries.
const sendToRecipient = async (
  email: LeaseTerminationConfirmationEmail,
  key: string,
  payloadHash: string,
  store: IdempotencyStore
): Promise<boolean> => {
  const claim = store.claim(key, payloadHash)
  // Already sent on an earlier, partially failed attempt.
  if (claim === 'duplicate') return true
  if (claim !== 'claimed') {
    // 'conflict' or 'in-flight': we cannot tell whether this holder got the
    // email, so never report it as sent.
    logger.error(
      { leaseId: email.leaseId, contactCode: email.contactCode, claim },
      'sendLeaseTerminationConfirmation: recipient key not claimable'
    )
    return false
  }

  let sent = false
  try {
    const result =
      await communicationAdapter.sendLeaseTerminationConfirmationEmail(email)
    sent = result.ok
    return sent
  } finally {
    if (sent) store.markSucceeded(key, payloadHash)
    else store.release(key, payloadHash)
  }
}

const sendToLeaseHolders = async (
  notification: LeaseTerminationNotification,
  idempotencyKey: string,
  payloadHash: string,
  store: IdempotencyStore
): Promise<SendOutcome> => {
  const leaseFacts = await getLeaseFacts(notification.leaseId)
  if (!leaseFacts.ok) return leaseFacts

  const holders = await getHolders(
    leaseFacts.data.contactCodes,
    notification.leaseId
  )
  if (!holders.ok) return holders

  const recipients: Recipient[] = []
  const skippedContactCodes: string[] = []
  for (const contact of holders.data) {
    const emailAddress = deliverableEmail(contact)
    if (emailAddress) {
      recipients.push({ contact, emailAddress })
    } else {
      skippedContactCodes.push(contact.contactCode)
      logger.warn(
        { leaseId: notification.leaseId, contactCode: contact.contactCode },
        'sendLeaseTerminationConfirmation: lease holder has no valid email address, skipping'
      )
    }
  }

  if (recipients.length === 0) return { ok: false, error: 'no-recipient' }

  const tenants = holders.data.map(toLeaseTerminationTenant)

  // allSettled, not all: a throwing send must not end this function while a
  // sibling send is still running, or the request key would be released early
  // and a retry admitted while that holder's send is in flight.
  const settled = await Promise.allSettled(
    recipients.map(({ contact, emailAddress }) => {
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
      return sendToRecipient(
        email,
        recipientKey(idempotencyKey, contact.contactCode),
        payloadHash,
        store
      )
    })
  )

  const rejected = settled.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected'
  )
  if (rejected) throw rejected.reason

  return settled.every((r) => r.status === 'fulfilled' && r.value)
    ? {
        ok: true,
        summary: { sentCount: recipients.length, skippedContactCodes },
      }
    : { ok: false, error: 'send-failed' }
}

export const sendLeaseTerminationConfirmation = async (
  notification: LeaseTerminationNotification,
  idempotencyKey: string,
  store: IdempotencyStore = tenantNotificationIdempotencyStore
): Promise<SendLeaseTerminationConfirmationResult> => {
  const payloadHash = hashNotificationPayload(notification)
  const key = requestKey(idempotencyKey)
  const claim = store.claim(key, payloadHash)

  if (claim === 'conflict') {
    return { ok: false, error: 'idempotency-conflict' }
  }

  if (claim === 'duplicate') {
    const summary = store.getSummary(key, payloadHash)
    // A request key is only ever marked succeeded together with its summary.
    if (!summary) {
      throw new Error('Succeeded idempotency record has no delivery summary')
    }
    return { ok: true, duplicate: true, summary }
  }

  // Another request with this key is still running and may yet fail, so this
  // one must not report the email as sent. The caller retries later.
  if (claim === 'in-flight') {
    return { ok: false, error: 'request-in-progress' }
  }

  // Release the key on any outcome but success — including a throw — so a
  // failed attempt never leaves it in-flight and blocks retries.
  let outcome: SendOutcome | undefined
  try {
    outcome = await sendToLeaseHolders(
      notification,
      idempotencyKey,
      payloadHash,
      store
    )
    return outcome.ok
      ? { ok: true, duplicate: false, summary: outcome.summary }
      : outcome
  } finally {
    if (outcome?.ok) store.markSucceeded(key, payloadHash, outcome.summary)
    else store.release(key, payloadHash)
  }
}
