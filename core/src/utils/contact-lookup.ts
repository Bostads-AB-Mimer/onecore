import type { Contact } from '@onecore/contacts/domain'
import { logger } from '@onecore/utilities'

import { contactsAdapter } from '../adapters/contacts-adapter'
import { errorLogFields } from './error-log'

export type ContactLookupDeps = {
  contacts: Pick<typeof contactsAdapter, 'getByContactCodeBatch'>
}

type ContactLookupOptions = Parameters<
  typeof contactsAdapter.getByContactCodeBatch
>[1]

const defaultDeps: ContactLookupDeps = { contacts: contactsAdapter }

// Xpand compares contact codes ignoring case and trailing blanks, so the
// contacts service finds 'P123456' for 'p123456 '. Match the same way here.
const codeKey = (code: string): string => code.trim().toUpperCase()

export type ContactFor = (
  contactCode: string | null | undefined
) => Contact | undefined

const noContact: ContactFor = () => undefined

/**
 * Looks every distinct contact code up in the contacts service in one batch,
 * and gives a function that returns the contact for a code. Fails closed: it
 * returns undefined for every code when the lookup fails, and for a code
 * whose contact has a protected identity or is missing, so person data only
 * ever comes from the contacts service and never for a protected person.
 *
 * The codes come from leases or invoices, so a missing contact is logged as
 * an error. logContext names the caller in the log.
 */
export const lookUpContactsFailClosed = async (
  contactCodes: (string | null | undefined)[],
  options: ContactLookupOptions,
  logContext: string,
  deps: ContactLookupDeps = defaultDeps
): Promise<ContactFor> => {
  // One code per contact, as first spelled.
  const byKey = new Map<string, string>()
  for (const contactCode of contactCodes) {
    const code = contactCode?.trim()
    if (code && !byKey.has(codeKey(code))) byKey.set(codeKey(code), code)
  }
  const codes = [...byKey.values()]

  if (codes.length === 0) return noContact

  let byCode: Map<string, Contact>
  try {
    const result = await deps.contacts.getByContactCodeBatch(codes, options)
    if (!result.ok) {
      logger.error(
        { status: result.statusCode, error: result.err },
        `${logContext}: contact lookup failed, person fields left blank`
      )
      return noContact
    }
    byCode = new Map(
      result.data.map((contact) => [codeKey(contact.contactCode), contact])
    )
  } catch (err: unknown) {
    logger.error(
      errorLogFields(err),
      `${logContext}: contact lookup threw, person fields left blank`
    )
    return noContact
  }

  const missing = codes.filter((code) => !byCode.has(codeKey(code)))
  if (missing.length > 0) {
    logger.error(
      { contactCodes: missing },
      `${logContext}: contacts missing from the contacts service, person fields left blank`
    )
  }

  return (contactCode) => {
    const contact = contactCode ? byCode.get(codeKey(contactCode)) : undefined
    return contact?.protectedIdentity ? undefined : contact
  }
}
