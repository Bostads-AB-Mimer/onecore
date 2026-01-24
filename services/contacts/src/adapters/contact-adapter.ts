import {
  Contact,
  ContactCode,
  ContactTypeFilter,
  EmailAddress,
  NationalIdNumber,
  PhoneNumber,
} from '@src/domain/contact'

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
   * @returns A promise that resolves to an array of Contact objects.
   */
  list: (params: ContactListParams) => Promise<Contact[]>

  /**
   * Retrieves a contact by its unique contact code.
   *
   * @param contactCode - The unique code of the contact to retrieve.
   *
   * @returns A promise that resolves to the Contact object if found,
   */
  getByContactCode: (contactCode: ContactCode) => Promise<Contact | null>

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
}
