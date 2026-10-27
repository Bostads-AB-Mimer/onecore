import { AdapterResult } from './types'

/**
 * Ways a contact write can fail.
 *
 * Deliberately enumerated rather than falling back on a generic 'unknown':
 * the route maps each of these to a distinct HTTP status, and the caseworker
 * UI maps each to a distinct Swedish message. Adding a failure mode means
 * adding a case here, not widening an existing one.
 */
export type ContactWriteError =
  /** No write backend is configured. Nothing was attempted. */
  | 'write-backend-not-configured'
  /** The backend understood the request and refused it. `detail` says why. */
  | 'xpand-rejected'
  /**
   * The service answered with a SOAP Fault — our request was malformed (e.g.
   * serializer rejected it), not refused by business rules. A caseworker can
   * do nothing about it, so `detail` is for logs and API consumers, never UI.
   */
  | 'xpand-fault'
  /** Transport failure — network, timeout, 5xx. Unknown whether anything was written. */
  | 'xpand-unavailable'
  /** Credentials were rejected. Nothing was written. */
  | 'xpand-auth-failed'
  /**
   * The call may have succeeded but the response could not be understood.
   * A contact may now exist whose code we do not know — callers must attempt
   * recovery rather than treating this as a plain failure.
   */
  | 'xpand-malformed-response'

export type ContactWriterAddress = {
  /** C/O line. Sent as PostalAddress2, the registration flow's convention. */
  careOf?: string
  street: string
  zipCode: string
  city: string
  /** Two-letter country code or country name. Defaults to Sweden when omitted. */
  country?: string
}

export type ContactWriterEmailAddress = {
  emailAddress: string
  isPrimary: boolean
}

export type ContactWriterPhoneNumber = {
  phoneNumber: string
  type: 'mobile' | 'home' | 'work'
  isPrimary: boolean
}

/**
 * Credentials for the web account that is provisioned alongside the contact.
 *
 * `name` is the username. Xpand's convention — mirrored from how mimer.nu
 * registers applicants — is that the username *is* the national id number.
 *
 * `password` is sent in cleartext over the (TLS-protected) SOAP call; Xpand
 * performs the hashing server-side with a key we do not hold. It must never
 * be logged, returned to a caller, or persisted on our side.
 */
export type ContactWriterCredentials = {
  name: string
  email: string
  password: string
}

export type CreateContactInput = {
  /** Normalised to 12 digits, no separators. */
  nationalId: string
  firstName: string
  lastName: string
  addresses: ContactWriterAddress[]
  emailAddresses: ContactWriterEmailAddress[]
  phoneNumbers: ContactWriterPhoneNumber[]
  credentials: ContactWriterCredentials
}

/**
 * The port through which contacts are written to the system of record.
 *
 * Everything above this interface is implementation-agnostic. Today the only
 * implementation talks to Xpand's Incit SOAP service; should ONECore ever own
 * contact master data directly, a database-backed implementation slots in here
 * without touching the service, route, or core layers.
 *
 * A single `createContact` covers every caseworker-facing contact type: they
 * are all created through the same upstream operation with the same fields.
 * What differs — housing queues, application profile — is orchestrated in core,
 * not here.
 *
 * Household size is deliberately not part of the input. It is ONECore data and
 * lives in the leasing service's application profile; Xpand's legacy field for
 * it is left unset.
 */
export interface ContactWriter {
  /**
   * Creates a contact in the system of record, together with its applicant
   * role and web account.
   *
   * ONECore has no way to undo this. A successful return means the contact
   * exists in the system of record, and removing it again is manual work in
   * Xpand. Callers must not retry a call that may have succeeded — see
   * `xpand-malformed-response`.
   *
   * @returns the generated contact code (e.g. `P069077`) on success.
   */
  createContact: (
    input: CreateContactInput
  ) => Promise<AdapterResult<{ contactCode: string }, ContactWriteError>>
}
