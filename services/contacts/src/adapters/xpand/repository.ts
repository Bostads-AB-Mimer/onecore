import { type Resource, logger } from '@onecore/utilities'
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
  RelatedContact,
  RelatedContactRole,
} from '@src/domain'
import {
  cmlogContactChanges,
  contactCodeForNationalId,
  contactObjectKeysForEmailAddress,
  contactObjectKeysForPhoneNumber,
  contactsQuery,
} from './query'
import { parseNationalId } from '@src/domain/national-id'
import { contactsByCodesQuery, ContactIncludeOptions } from './batch-query'
import { transformDbContactRows } from './transform'
import { DbContactRow } from './db-model'
import { contactExists } from './contact-lookup-query'
import {
  relatedContactsFor,
  relatedContactsForMany,
} from '@src/adapters/contact-relations'

/**
 * Creates a ContactsRepository that reads contact data from the Xpand
 * database and related contacts from the contacts service's own database.
 *
 * @param db - A Resource wrapping a Knex connection to the Xpand database.
 * @param contactsDb - A Resource wrapping a Knex connection to the contacts
 *                     service's own database.
 *
 * @returns An implementation of the ContactsRepository interface.
 */
export const xpandContactsRepository = (
  db: Resource<knex.Knex>,
  contactsDb: Resource<knex.Knex>
): ContactsRepository => {
  /**
   * Populates `relatedContacts` on a batch of contacts using a single grouped
   * relation query (not N+1). Contacts with no relations get an empty array.
   */
  const withRelatedContacts = async (
    contacts: Contact[]
  ): Promise<Contact[]> => {
    if (contacts.length === 0) return contacts
    const byCode = await relatedContactsForMany(
      db.get(),
      contactsDb.get(),
      contacts.map((c) => c.contactCode)
    )
    for (const c of contacts) {
      c.relatedContacts = byCode.get(c.contactCode) ?? []
    }
    return contacts
  }

  /**
   * The subject's related contacts filtered to one role. Null when the
   * subject does not exist in Xpand; empty array when it exists but has no
   * relations in that role.
   */
  const relationsByRole = async (
    contactCode: ContactCode,
    role: RelatedContactRole
  ): Promise<RelatedContact[] | null> => {
    // The exists check and the relation fetch are independent; run them in
    // one wave like the Xpand-backed predecessor did.
    const [exists, all] = await Promise.all([
      contactExists(db.get(), contactCode),
      relatedContactsFor(db.get(), contactsDb.get(), contactCode),
    ])
    if (!exists) return null
    return all.filter((r) => r.role === role)
  }

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

      const query = contactsQuery()
        .isContactType(filter.type)
        .wildcard(filter.wildcard)
        .paginate({ page, pageSize })

      const [rows, totalRecords] = await Promise.all([
        query.getPage(db.get()),
        query.getCount(db.get()),
      ])

      return {
        content: transformDbContactRows(rows),
        totalRecords,
      }
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

      const contact = transformDbContactRows(dbContactRows)[0]
      if (!contact) return null
      contact.relatedContacts = await relatedContactsFor(
        db.get(),
        contactsDb.get(),
        contact.contactCode
      )
      return contact
    },

    /**
     * Batch lookup of contacts by their contact codes. Uses the lean
     * `contactsByCodesQuery` which omits phone/email/address joins by
     * default — only base `cmctc` columns.
     */
    getByContactCodeBatch: async (
      contactCodes: ContactCode[],
      options?: ContactIncludeOptions
    ) => {
      if (contactCodes.length === 0) return []

      const rows = await contactsByCodesQuery(db.get(), contactCodes, options)
      const contacts = transformDbContactRows(rows)

      return options?.includeRelations
        ? withRelatedContacts(contacts)
        : contacts
    },

    getAdministrators: (contactCode) =>
      relationsByRole(contactCode, 'administrator'),

    getAdministratorsFor: (contactCode) =>
      relationsByRole(contactCode, 'administratorFor'),

    getTrustees: (contactCode) => relationsByRole(contactCode, 'trustee'),

    getTrusteesFor: (contactCode) => relationsByRole(contactCode, 'trusteeFor'),

    getOtherInvoiceRecipients: (contactCode) =>
      relationsByRole(contactCode, 'otherInvoiceRecipient'),

    getOtherInvoiceRecipientsFor: (contactCode) =>
      relationsByRole(contactCode, 'otherInvoiceRecipientFor'),

    /**
     * Retrieves a contact by their national ID number.
     *
     * @param nid - The national ID number to search for.
     *
     * @returns A promise that resolves to the Contact object if found,
     */
    getByNationalIdNumber: async (nid: NationalIdNumber) => {
      const dbContactRows = await contactsQuery()
        .hasNationalId(nid.replaceAll(/[^0-9]/g, ''))
        .getOne(db.get())

      const contact = transformDbContactRows(dbContactRows)[0]
      if (!contact) return null
      contact.relatedContacts = await relatedContactsFor(
        db.get(),
        contactsDb.get(),
        contact.contactCode
      )
      return contact
    },

    existsByNationalIdNumber: async (nid: NationalIdNumber) => {
      const forms = parseNationalId(nid)

      // Not a valid identity number, so it cannot match an existing contact.
      // The caller validates and reports that separately; returning null here
      // simply means "no duplicate found", which is correct.
      if (!forms) return null

      try {
        return await contactCodeForNationalId(db.get(), forms)
      } catch (err) {
        logger.error({ err }, 'contactsRepository.existsByNationalIdNumber')
        throw err
      }
    },

    /**
     * Retrieves contacts filtered by their phone number.
     *
     * Phone numbers are not normalized in the Xpand database and is
     * just as likely to be a well-formatted phone number as it is
     * to be "Same as their neighbour Olle, who sometimes walks their
     * dog."
     *
     * This means that phone numbers are not unique, and moreover may
     * occur multiple times in multiple formats.
     *
     * @param phoneNumber - The phone number to search for.
     * @returns A promise that resolves to a list of Contact objects if found,
     *          or empty list if no contact is found.
     */
    getByPhoneNumber: async (phoneNumber: PhoneNumber): Promise<Contact[]> => {
      const contactObjectKeys = await contactObjectKeysForPhoneNumber(
        db.get(),
        phoneNumber.replaceAll(/[^0-9]/g, '')
      )
      if (contactObjectKeys.length) {
        const rows: DbContactRow[] = await contactsQuery()
          .withObjectKeyIn(contactObjectKeys)
          .getPage(db.get())

        return withRelatedContacts(transformDbContactRows(rows))
      }

      return []
    },

    /**
     * Retrieves contacts filtered by their email addresses.
     *
     * Email adresses, just like phone numbers, are not normalized in the
     * database - but the data quality is generally higher than for
     * phone numbers.
     *
     * This means that email addresses are not unique, and may occur
     * multiple times.
     *
     * @param emailAddress - The email address to search for.
     * @returns A promise that resolves to a list of Contact objects if found,
     *          or empty list if no contact is found.
     */
    getByEmailAddress: async (emailAddress: string): Promise<Contact[]> => {
      const contactObjectKeys = await contactObjectKeysForEmailAddress(
        db.get(),
        emailAddress.trim()
      )
      if (contactObjectKeys.length) {
        const rows: DbContactRow[] = await contactsQuery()
          .withObjectKeyIn(contactObjectKeys)
          .getPage(db.get())

        return withRelatedContacts(transformDbContactRows(rows))
      }

      return []
    },

    /**
     * Retrieves full Contact objects for the given list of contact codes in a single batch.
     *
     * @param codes - The contact codes to fetch.
     * @returns A promise that resolves to an array of Contact objects.
     */
    getByContactCodes: async (
      codes: ContactCode[],
      options?: { includeRelations?: boolean }
    ): Promise<Contact[]> => {
      if (codes.length === 0) return []
      const rows = await contactsQuery()
        .withContactCodeIn(codes)
        .getPage(db.get(), { page: 0, pageSize: codes.length })
      const contacts = transformDbContactRows(rows)
      return options?.includeRelations
        ? withRelatedContacts(contacts)
        : contacts
    },

    /**
     * Retrieves contact codes for contacts updated since the given timestamp,
     * each paired with the latest logtime for that code. Results are ordered
     * by timestamp ascending so callers can checkpoint per item. If no
     * timestamp is provided, returns all matching rows.
     *
     * @param since - The timestamp to query changes from, or null for all rows.
     * @returns A promise that resolves to contact codes with timestamps, ordered ascending.
     */
    getChangedContactCodes: async (
      since: Date | null
    ): Promise<{ contactCode: string; timestamp: Date }[]> => {
      const rows = await cmlogContactChanges(db.get(), since)

      const byContactCode = new Map<string, Date>()
      for (const row of rows) {
        const match = (row['logmemo'] as string)?.match(/^Kontakt (\S+)/)
        if (!match) continue
        byContactCode.set(match[1], row['logtime'] as Date)
      }

      const contactCodes = Array.from(byContactCode.entries())
        .map(([contactCode, timestamp]) => ({ contactCode, timestamp }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      logger.info(
        { contactCodes: contactCodes.map((c) => c.contactCode) },
        'cmlog contact codes updated since last sync'
      )

      return contactCodes
    },
  }
}
