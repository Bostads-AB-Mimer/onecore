import {
  DbAddress,
  DbContactRow,
  DbContact,
  DbContactDetails,
  DbContactDetailsMap,
  DbEmailAddress,
  DbPhoneNumber,
} from '@xpand/db-model'
import {
  Contact,
  ContactIndividual,
  ContactOrganisation,
  ContactType,
  ObjectKey,
  Trustee,
} from '@src/domain/contact'
import { redact, trimRow } from './common'
import { transformPhoneNumbers } from './phone'
import { transformEmailAddresses } from './email'
import { toAddresses } from './address'

const NO_CONTACT_DETAILS: DbContactDetails = {
  phoneNumbers: [],
  emailAddresses: [],
  addresses: [],
}

const toContactKeys = (row: DbContact) => ({
  contactCode: row.contactCode,
  contactKey: row.contactKey,
})

export const toCommunicationFragment = (
  row: DbContact,
  contactDetails: DbContactDetails,
  protectedIdentity: boolean
) => {
  return {
    phoneNumbers: redact(
      transformPhoneNumbers(contactDetails.phoneNumbers),
      'phoneNumber',
      protectedIdentity
    ),
    emailAddresses: redact(
      transformEmailAddresses(contactDetails.emailAddresses),
      'emailAddress',
      protectedIdentity
    ),
    specialAttention: !!row.specialAttention,
  }
}

export const toTrustee = (row: DbContact): { trustee?: Trustee } => {
  if (row.trusteeId) {
    return {
      trustee: {
        contactCode: row.trusteeId.trim(),
        fullName: row.trusteeName?.trim(),
      },
    }
  }
  return {}
}

/**
 * Transform a DbContact row to a ContactIndividual domain object.
 *
 * @param row The DbContact row
 * @param contactDetails The DbContactDetails for the contact
 *
 * @returns The transformed ContactIndividual
 */
export const toIndividual = (
  row: DbContact,
  contactDetails: DbContactDetails
): ContactIndividual => {
  const protectedIdentity = row.protectedIdentity !== null

  return {
    type: 'individual',
    ...toContactKeys(row),
    personal: {
      firstName: protectedIdentity ? 'redacted' : row.firstName || '',
      lastName: protectedIdentity ? 'redacted' : row.lastName || '',
      fullName: protectedIdentity ? 'redacted' : row.fullName,
      nationalRegistrationNumber: protectedIdentity ? 'redacted' : row.nid,
      birthDate: protectedIdentity ? 'redacted' : row.birthDate,
    },
    ...toTrustee(row),
    communication: toCommunicationFragment(
      row,
      contactDetails,
      protectedIdentity
    ),
    addresses: toAddresses(contactDetails.addresses, protectedIdentity),
  }
}

/**
 * Transform a DbContact to a ContactOrganisation domain object
 */
export const toOrganisation = (
  row: DbContact,
  contactDetails: DbContactDetails
): ContactOrganisation => {
  return {
    type: 'organisation',
    ...toContactKeys(row),
    organisation: {
      organisationNumber: row.nid,
      name: row.fullName,
    },
    communication: toCommunicationFragment(row, contactDetails, false),
    addresses: toAddresses(contactDetails.addresses, false),
  }
}

/**
 * Determine the contact type of a DbContact row.
 *
 * The "law" that individuals have contact codes that begin with 'P' and
 * organisations with 'F' is not universal. There are hundreds of rows
 * in the Mimer database that have no leading character at all, and
 * a few hundred with a leading 'I', 'K', 'L', 'S', 'O' or 'Ö'.
 *
 * FIXME: In all likelihood the non-character prefixed contact codes are legacy
 * but this is where we could make a best-effort attempt to identify the
 * the type. This shoddy attempt doesn't hold water, as there are plenty
 * of individuals in the database that have null firstName(fnamn) values.
 *
 * @param dbContact The DbContact row
 *
 * @returns The resolved contact type
 */
export const resolveContactType = (dbContact: DbContact): ContactType => {
  const { contactCode } = dbContact

  switch (contactCode.charAt(0)) {
    case 'P':
      return 'individual'
    case 'F':
    case 'I':
    case 'K':
    case 'L':
    case 'O':
    case 'S':
    case 'Ö':
      return 'organisation'
    default:
      if (contactCode.match(/^[0-9]/) && !dbContact.firstName) {
        return 'organisation'
      } else {
        return 'individual'
      }
  }
}

export const transformDbContacts = (
  dbRows: DbContact[],
  metadata: DbContactDetailsMap
) => {
  return dbRows.map((row) =>
    transformDbContact(row, metadata[row.contactKey] ?? NO_CONTACT_DETAILS)
  )
}

export const transformDbContact = (
  dbRow: DbContact,
  contactDetails: DbContactDetails
): Contact => {
  const row = trimRow(dbRow)
  const type = resolveContactType(dbRow)

  return type === 'individual'
    ? toIndividual(row, contactDetails)
    : toOrganisation(row, contactDetails)
}

export const toContact = (rows: DbContactRow[]): Contact => {
  const [contactData] = rows
  const contactDetails: DbContactDetails = {
    phoneNumbers: [],
    emailAddresses: [],
    addresses: [],
  }

  rows.forEach((row) => {
    if (
      row.addressId &&
      !contactDetails.addresses.some((a) => a.addressId === row.addressId)
    ) {
      contactDetails.addresses.push(row as DbAddress)
    }
    if (
      row.emailId &&
      !contactDetails.emailAddresses.some((e) => e.emailId === row.emailId)
    ) {
      contactDetails.emailAddresses.push(row as DbEmailAddress)
    }
    if (
      row.phoneNumber &&
      !contactDetails.phoneNumbers.some((p) => p.phoneId === row.phoneId)
    ) {
      contactDetails.phoneNumbers.push(row as DbPhoneNumber)
    }
  })

  return transformDbContact(contactData, contactDetails)
}

export const collapseContactRows = (rows: DbContactRow[]) => {
  return rows.reduce(
    (aggr, row) => {
      ;(aggr[row.objectKey] ??= []).push(row)
      return aggr
    },
    {} as Record<ObjectKey, DbContactRow[]>
  )
}

export const transformDbContactRows = (rows: DbContactRow[]) => {
  const byContact = collapseContactRows(rows)
  return Object.values(byContact).map(toContact)
}
