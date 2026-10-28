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

/**
 * Transform a DbContact row to a ContactIndividual domain object.
 *
 * A protected identity is redacted unless `exempt` — a tenant or invoice
 * recipient, whose data in Xpand is already anonymised and is needed for
 * invoicing. `protectedIdentity` is reported either way.
 *
 * @param row The DbContact row
 * @param contactDetails The DbContactDetails for the contact
 * @param exempt Whether a protected identity is exempt from redaction
 *
 * @returns The transformed ContactIndividual
 */
export const toIndividual = (
  row: DbContact,
  contactDetails: DbContactDetails,
  exempt = false
): ContactIndividual => {
  const protectedIdentity = row.protectedIdentity !== null
  const redacted = protectedIdentity && !exempt

  return {
    type: 'individual',
    ...toContactKeys(row),
    protectedIdentity,
    personal: {
      firstName: redacted ? 'redacted' : row.firstName || '',
      lastName: redacted ? 'redacted' : row.lastName || '',
      fullName: redacted ? 'redacted' : row.fullName,
      nationalId: redacted ? 'redacted' : row.nid,
      birthDate: redacted ? 'redacted' : row.birthDate,
    },
    communication: toCommunicationFragment(row, contactDetails, redacted),
    addresses: toAddresses(contactDetails.addresses, redacted),
  }
}

/**
 * Whether a protected identity is exempt from redaction: a tenant (see
 * `isLeaseHolderColumn`) or an annan fakturamottagare.
 */
const isRedactionExempt = (row: DbContact, invoiceRecipients: Set<string>) =>
  row.isLeaseHolder === 1 || invoiceRecipients.has(row.contactCode.trim())

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
    protectedIdentity: false,
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
  metadata: DbContactDetailsMap,
  invoiceRecipients: Set<string> = new Set()
) => {
  return dbRows.map((row) =>
    transformDbContact(
      row,
      metadata[row.contactKey] ?? NO_CONTACT_DETAILS,
      invoiceRecipients
    )
  )
}

/**
 * @param invoiceRecipients Trimmed codes of contacts that are an annan
 *                          fakturamottagare, exempting them from redaction.
 */
export const transformDbContact = (
  dbRow: DbContact,
  contactDetails: DbContactDetails,
  invoiceRecipients: Set<string> = new Set()
): Contact => {
  const row = trimRow(dbRow)
  const type = resolveContactType(dbRow)

  return type === 'individual'
    ? toIndividual(
        row,
        contactDetails,
        isRedactionExempt(row, invoiceRecipients)
      )
    : toOrganisation(row, contactDetails)
}

export const toContact = (
  rows: DbContactRow[],
  invoiceRecipients: Set<string> = new Set()
): Contact => {
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

  return transformDbContact(contactData, contactDetails, invoiceRecipients)
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

export const transformDbContactRows = (
  rows: DbContactRow[],
  invoiceRecipients: Set<string> = new Set()
) => {
  const byContact = collapseContactRows(rows)
  return Object.values(byContact).map((contactRows) =>
    toContact(contactRows, invoiceRecipients)
  )
}
