import { Resource } from '@src/common/resource'
import knex from 'knex'
import {
  ContactListParams,
  ContactsRepository,
} from '@src/adapters/contact-adapter'
import { PhoneNumber, Contact, NationalIdNumber } from '@src/domain/contact'
import { contactsBaseQuery, contactsQuery } from './query'

export const trimRow = (obj: any): any => {
  return Object.fromEntries(
    Object.entries(obj ?? {}).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trimEnd() : value,
    ])
  )
}

const toContact = (
  row: any,
  metadata: Record<string, { phoneNumbers: any[] }>
) => {
  return transformFromDbContact(
    [row],
    metadata[row.contactKey]?.phoneNumbers ?? []
  )
}

const transformFromDbContact = (
  rows: Array<any>,
  phoneNumbers: any
): Contact => {
  const row = trimRow(rows[0])
  const protectedIdentity = row.protectedIdentity !== null

  const contact = {
    contactCode: row.contactCode,
    contactKey: row.contactKey,
    identity: {
      firstName: protectedIdentity ? undefined : row.firstName,
      lastName: protectedIdentity ? undefined : row.lastName,
      fullName: protectedIdentity ? undefined : row.fullName,
      nationalRegistrationNumber: protectedIdentity
        ? undefined
        : row.nationalRegistrationNumber,
      birthDate: protectedIdentity ? undefined : row.birthDate,
    },
    communication: {
      phoneNumbers: phoneNumbers,
      emailAddresses:
        row.emailAddress == null || protectedIdentity
          ? []
          : [
              {
                emailAddress:
                  process.env.NODE_ENV === 'production'
                    ? row.emailAddress
                    : 'redacted',
                isMain: true,
                type: 'unspecified',
              },
            ],
      specialAttention: !!row.specialAttention,
    },
    addresses: [
      {
        street: row.street,
        number: '',
        zipCode: row.postalCode,
        city: row.city,
      },
    ],
  }

  return contact
}

export const xpandContactsRepository = (
  db: Resource<knex.Knex>
): ContactsRepository => {
  const findContactMetadata = async (contactKeys: string[]) => {
    const rows = await db
      .get()
      .from('cmtel')
      .select(
        'keycmobj as contactKey',
        'cmtelben as phoneNumber',
        'keycmtet as type',
        'main as isMainNumber'
      )
      .whereIn('keycmobj', contactKeys)

    return rows.reduce((metadata, phoneNum) => {
      const contactMeta = (metadata[phoneNum.contactKey] ??= {
        phoneNumbers: [],
      })
      contactMeta.phoneNumbers.push(phoneNum)
      return metadata
    }, {})
  }

  const getContactForPhoneNumber = async (phoneNumber: string) => {
    const rows = await db
      .get()
      .from('cmtel')
      .select('keycmobj as keycmobj')
      .where({ cmtelben: phoneNumber })

    return rows
  }

  const getPhoneNumbersForContact = async (keycmobj: string) => {
    let rows = await db
      .get()
      .from('cmtel')
      .select(
        'cmtelben as phoneNumber',
        'keycmtet as type',
        'main as isMainNumber'
      )
      .where({ keycmobj: keycmobj })

    rows = rows.map((row) => {
      return trimRow(row)
    })

    return rows
  }

  const paginate = <A extends {}, S>(
    query: knex.Knex.QueryBuilder<A, S>,
    page: number,
    pageSize: number
  ) => {
    return query
      .offset(page * pageSize)
      .limit(pageSize)
      .orderBy('cmctc.cmctckod')
  }

  return {
    list: async ({ filter, page, pageSize }: ContactListParams) => {
      if (typeof page !== 'number' || isNaN(page)) {
        page = 0
      }
      if (typeof pageSize !== 'number' || isNaN(pageSize)) {
        pageSize = 10
      }

      const rows = await contactsQuery()
        .wildcard(filter.wildcard)
        .paginate({ page, pageSize })
        .execute(db.get())

      const additional = await findContactMetadata(
        rows.map((row) => row.contactKey)
      )

      return rows.map((row) => toContact(row, additional))
    },

    getByNationalIdNumber: async (nid: NationalIdNumber) => {
      const rows = await contactsQuery().hasNationalId(nid).execute(db.get())

      if (rows && rows.length > 0) {
        const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
        return transformFromDbContact(rows, phoneNumbers)
      }

      return null
    },

    getByPhoneNumber: async (
      phoneNumber: PhoneNumber
    ): Promise<Contact | null> => {
      const keycmobj = await getContactForPhoneNumber(phoneNumber)
      if (keycmobj && keycmobj.length > 0) {
        const rows = await contactsBaseQuery(db.get()).where({
          'cmctc.keycmobj': keycmobj[0].keycmobj,
        })

        if (rows && rows.length > 0) {
          const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
          return transformFromDbContact(rows, phoneNumbers)
        }
      }

      return null
    },
  }
}
