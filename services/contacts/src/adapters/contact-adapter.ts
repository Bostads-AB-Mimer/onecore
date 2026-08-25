import {
  Contact,
  ContactCode,
  ContactTypeFilter,
  NationalIdNumber,
  PhoneNumber,
  RelatedContact,
} from '@src/domain/contact'
import { ContactIncludeOptions } from './xpand/batch-query'

/**
 * Parameters for listing contacts with optional filtering and pagination
 *
 * @property filter - An object containing filtering options
 */
export type ContactListParams = {
  filter: {
    /**
     * Filter contact list by contact type. 'any' = no filter.
     */
    type: ContactTypeFilter

    /**
     * A wildcard string or array of strings to filter contacts by
     * any searchable property
     */
    wildcard?: string | string[]
  }
} & Pagination

/**
 * Pagination parameters for fetching lists of items
 */
export interface Pagination {
  /**
   * The page number to retrieve (0-based index)
   */
  page: number
  /**
   * The number of items per page
   */
  pageSize: number
}

export interface ContactsRepository {
  /**
   * Lists contacts with optional filtering and pagination.
   *
   * @param params - Parameters for listing contacts, including
   *                 filter and pagination options.
   *
   * @returns A promise that resolves to the page of contacts and the total record count.
   */
  list: (params: ContactListParams) => Promise<{
    content: Contact[]
    totalRecords: number
  }>

  /**
   * Retrieves a contact by its unique contact code.
   *
   * @param contactCode - The unique code of the contact to retrieve.
   *
   * @returns A promise that resolves to the Contact object if found,
   */
  getByContactCode: (contactCode: ContactCode) => Promise<Contact | null>

  /**
   * Batch lookup of contacts by their contact codes. Lean by default —
   * returns only base contact fields with empty phone/email/address arrays
   * unless any `include*` flag is set.
   *
   * @param contactCodes - The contact codes to look up.
   * @param options - Optional include flags for phone/email/address joins.
   *
   * @returns A promise that resolves to an array of Contact objects in
   *          unspecified order. Missing codes are simply absent from the result.
   */
  getByContactCodeBatch: (
    contactCodes: ContactCode[],
    options?: ContactIncludeOptions
  ) => Promise<Contact[]>

  /**
   * Retrieves the förvaltare of a contact as RelatedContact objects with role
   * 'administrator'.
   *
   * @returns null when the subject contact does not exist; empty array when
   *          it exists but has no förvaltare.
   */
  getAdministrators: (
    contactCode: ContactCode
  ) => Promise<RelatedContact[] | null>

  /**
   * Retrieves the contacts the given contact is förvaltare for (the inverse
   * direction) as RelatedContact objects with role 'administratorFor'.
   *
   * @returns null when the subject contact does not exist; empty array when
   *          it exists but is not a förvaltare for anyone.
   */
  getAdministratorsFor: (
    contactCode: ContactCode
  ) => Promise<RelatedContact[] | null>

  /**
   * Retrieves the god man of a contact as RelatedContact objects with role
   * 'trustee'.
   *
   * @returns null when the subject contact does not exist; empty array when
   *          it exists but has no god man.
   */
  getTrustees: (contactCode: ContactCode) => Promise<RelatedContact[] | null>

  /**
   * Retrieves the contacts the given contact is god man for (the inverse
   * direction) as RelatedContact objects with role 'trusteeFor'.
   *
   * @returns null when the subject contact does not exist; empty array when
   *          it exists but is not a god man for anyone.
   */
  getTrusteesFor: (contactCode: ContactCode) => Promise<RelatedContact[] | null>

  /**
   * Retrieves the annan fakturamottagare on the contact's current leases as
   * RelatedContact objects with role 'otherInvoiceRecipient'. Null when the
   * contact does not exist.
   */
  getOtherInvoiceRecipients: (
    contactCode: ContactCode
  ) => Promise<RelatedContact[] | null>

  /**
   * Retrieves the current lease holders this contact is the annan
   * fakturamottagare for, as RelatedContact objects with role
   * 'otherInvoiceRecipientFor'. Null when the contact does not exist.
   */
  getOtherInvoiceRecipientsFor: (
    contactCode: ContactCode
  ) => Promise<RelatedContact[] | null>

  /**
   * Retrieves contacts by their national ID number.
   *
   * @param nid - The national ID number to search for.
   *
   * @returns A promise that resolves to an array of Contact objects
   */
  getByNationalIdNumber: (nid: NationalIdNumber) => Promise<Contact | null>

  /**
   * Retrieves contacts by their phone number.
   *
   * Phone numbers are not unique, and may result in multiple matches.
   *
   * @param phoneNumber - The phone number to search for.
   *
   * @returns A promise that resolves to an array of Contact objects
   */
  getByPhoneNumber: (phoneNumber: PhoneNumber) => Promise<Contact[]>

  /**
   * Retrieves contacts by their email address.
   *
   * Email addresses are not unique, and may result in multiple matches.
   *
   * @param emailAddress - The email address to search for.
   *
   * @returns A promise that resolves to an array of Contact objects
   */
  getByEmailAddress: (emailAddress: string) => Promise<Contact[]>

  /**
   * Retrieves contact codes for contacts changed since the given timestamp,
   * each paired with the latest logtime for that code. Results are ordered
   * by timestamp ascending. If no timestamp is provided, returns all
   * matching rows.
   *
   * @param since - The timestamp to query changes from, or null for all rows.
   *
   * @returns A promise that resolves to contact codes with timestamps, ordered ascending.
   */
  getChangedContactCodes: (
    since: Date | null
  ) => Promise<{ contactCode: string; timestamp: Date }[]>

  /**
   * Retrieves full Contact objects for the given list of contact codes in a single batch.
   *
   * @param codes - The contact codes to fetch.
   * @param options - When `includeRelations` is set, each contact is populated
   *                  with its related contacts: god man/förvaltare
   *                  relations plus other-invoice-recipient relations (both
   *                  directions).
   *
   * @returns A promise that resolves to an array of Contact objects.
   */
  getByContactCodes: (
    codes: ContactCode[],
    options?: { includeRelations?: boolean }
  ) => Promise<Contact[]>
}
