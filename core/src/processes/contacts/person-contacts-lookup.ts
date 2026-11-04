import type { AdapterResult } from '../../adapters/types'

/** A contact that is a private individual, as opposed to a company or a placeholder row. */
export type PersonContact = {
  contactCode: string
  /** Whether Xpand lets this contact log in to Mina sidor. */
  isActive: boolean
}

export type PersonContactsLookupError =
  /** The contacts service cannot answer this question yet. */
  'not-implemented' | 'contacts-service-error'

/**
 * Every person contact for a personnummer, each marked active or inactive.
 *
 * "Person contact" means a P code that is not soft-deleted and is not a GDPR placeholder.
 * Unlike the contacts service's duplicate check, which matches any row with the number,
 * this only counts contacts a person could actually log in with.
 *
 * Not implemented yet: the contacts service has no query that marks contacts active, and what
 * "active" means in Xpand is still being worked out. Until it has one, this answers
 * 'not-implemented' and registration refuses to run, rather than guessing who is active.
 *
 * @param _nationalId twelve digits
 */
export const lookupPersonContacts = async (
  _nationalId: string
): Promise<AdapterResult<PersonContact[], PersonContactsLookupError>> => ({
  ok: false,
  err: 'not-implemented',
})
