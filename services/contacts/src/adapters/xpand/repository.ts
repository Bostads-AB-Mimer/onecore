import { type Resource } from '@onecore/utilities'
import knex from 'knex'
import {
  ContactListParams,
  ContactsRepository,
} from '@src/adapters/contact-adapter'
import {
  PhoneNumber,
  Contact,
  ContactCode,
  NationalIdNumber,
} from '@src/domain'
import { contactObjectKeysForPhoneNumber, contactsQuery } from './query'
import { transformDbContactRows } from './transform'
import { DbContactRow } from './db-model'

/**
 * Creates a ContactsRepository that interacts with the Xpand database,
 * using the provided Knex database resource.
 *
 * @param db - A Resource wrapping a Knex database connection.
 *
 * @returns An implementation of the ContactsRepository interface.
 */
export const xpandContactsRepository = (
  db: Resource<knex.Knex>
): ContactsRepository => {
  return {
    /**
     * Retrieve a paginated and, optionally, filtered list of contacts
     *
     * @param params - Parameters for listing contacts, including filter
     *                 and pagination options.
     *
     * @returns A promise that resolves to an array of Contact objects.
     */
    list: async ({ filter, page, pageSize }: ContactListParams) => {
      if (typeof page !== 'number' || isNaN(page)) {
        page = 0
      }
      if (typeof pageSize !== 'number' || isNaN(pageSize)) {
        pageSize = 10
      }

      const rows = await contactsQuery()
        .isContactType(filter.type)
        .wildcard(filter.wildcard)
        .paginate({ page, pageSize })
        .getPage(db.get())

      return transformDbContactRows(rows)
    },

    /**
     * Retrieves a single contact by its, theoretically, unique contact
     * code.
     *
     * @param contactCode - The unique code of the contact to retrieve.
     *
     * @returns A promise that resolves to the Contact object if found,
     */
    getByContactCode: async (contactCode: ContactCode) => {
      const dbContactRows = await contactsQuery()
        .hasContactCode(contactCode)
        .getOne(db.get())

      return transformDbContactRows(dbContactRows)[0]
    },

    /**
     * Retrieves a contact by their national ID number.
     *
     * @param nid - The national ID number to search for.
     *
     * @returns A promise that resolves to the Contact object if found,
     */
    getByNationalIdNumber: async (nid: NationalIdNumber) => {
      const dbContactRows = await contactsQuery()
        .hasNationalId(nid)
        .getOne(db.get())

      return transformDbContactRows(dbContactRows)[0]
    },

    /**
     * Retrieves a contact by their phone number.
     *
     * Phone numbers are not normalized in the Xpand database and is
     * just as likely to be a well-formatted phone number as it is
     * to be "Same as their neighbour Olle, who sometimes walks their
     * dog."
     *
     * @param phoneNumber - The phone number to search for.
     * @returns A promise that resolves to the Contact object if found,
     *          or null if no contact is found.
     */
    getByPhoneNumber: async (
      phoneNumber: PhoneNumber
    ): Promise<Contact[] | null> => {
      const contactObjectKeys = await contactObjectKeysForPhoneNumber(
        db.get(),
        phoneNumber.replaceAll(/[^0-9]/g, '')
      )
      if (contactObjectKeys.length) {
        const rows: DbContactRow[] = await contactsQuery()
          .withObjectKeyIn(contactObjectKeys)
          .getPage(db.get())

        return transformDbContactRows(rows)
      }

      return []
    },
  }
}
