import { ContactCategory } from '@src/domain/contact'
import { AdapterResult } from './types'

/**
 * Ways a category conversion can fail.
 *
 * Enumerated so the service can decide what to do with each: retry, treat as
 * done, or give up and report. None of them means the contact is gone.
 */
export type ContactConversionError =
  /** No contact carries the given person code. Nothing was changed. */
  | 'contact-not-found'
  /**
   * The person code is gone but a contact with the converted code exists —
   * a previous attempt completed. Nothing was changed; the caller may treat
   * the conversion as done.
   */
  | 'already-converted'
  /** The category has no known Xpand key. Nothing was attempted. */
  | 'unsupported-category'
  /** The database refused or the connection failed. Safe to retry. */
  | 'xpand-db-error'

export type ConvertContactInput = {
  /** The person code the contact was created under, e.g. `P069077`. */
  contactCode: string
  category: ContactCategory
  /** The organisation's name, written to the contact's single name field. */
  name: string
}

/**
 * Matches a contact code in the P series and captures its number.
 *
 * Xpand's number series is shared across every category, so re-prefixing the
 * same digits cannot collide with an independently allocated code.
 */
const PERSON_CONTACT_CODE = /^P(\d+)$/

/**
 * The code a person contact takes once converted to the given category: the
 * category letter followed by the same number.
 *
 * @returns null when `personContactCode` is not a P-series code.
 */
export const convertedContactCode = (
  personContactCode: string,
  category: ContactCategory
): string | null => {
  const match = PERSON_CONTACT_CODE.exec(personContactCode.trim())
  return match ? `${category}${match[1]}` : null
}

/**
 * The port through which a freshly created contact is turned into an
 * organisation.
 *
 * Separate from `ContactWriter` because it writes through a different backend:
 * creation goes through Xpand's SOAP service, which can only produce natural
 * persons, while the correction is a direct database update. The update is
 * idempotent, so callers may retry it freely — unlike creation.
 *
 * Safe immediately after creation only: the contact code has a unique index
 * but is not a relation key (every foreign key into `cmctc` goes via
 * `keycmctc`), and no lease, invoice or queue row can reference a contact
 * that was created moments ago.
 */
export interface ContactCategoryWriter {
  /**
   * Sets the contact's category, writes its name to the single name field,
   * clears the person-only fields (first name, last name, birth date) and
   * re-prefixes the contact code with the category letter.
   *
   * @returns the converted contact code (e.g. `F069077`) on success.
   */
  convertToOrganisation: (
    input: ConvertContactInput
  ) => Promise<AdapterResult<{ contactCode: string }, ContactConversionError>>
}
