import { leasing } from '@onecore/types'
import type { Contact } from '@onecore/contacts/domain'
import { logger } from '@onecore/utilities'

import {
  primaryEmailAddress,
  primaryPhoneNumber,
  resolvePersonnummer,
} from '../../../adapters/contacts-adapter/lease-query'
import type { HomeInsuranceAdapterError } from '../../../adapters/leasing-adapter/leases'
import { HomeInsuranceLfColumnValues } from '../../../processes/reports/converters/home-insurance-columns'
import {
  ContactLookupDeps,
  lookUpContactsFailClosed,
} from '../../../utils/contact-lookup'
import { errorLogFields } from '../../../utils/error-log'
import type {
  HomeInsuranceContactFields,
  HomeInsuranceListItemWithContact,
  HomeInsuranceListQuery,
  HomeInsuranceListRouteErrorCode,
} from '../schemas/home-insurance'

/**
 * The status each home insurance error answers with. Leasing's codes keep
 * the status leasing gave them, so core answers 1:1.
 */
export const HOME_INSURANCE_ERROR_STATUS: Record<
  HomeInsuranceAdapterError,
  number
> = {
  'lease-not-found': 404,
  'home-insurance-row-not-found': 404,
  'home-insurance-row-changed': 409,
  'home-insurance-already-exists': 422,
  'end-date-before-start': 400,
  'end-date-unchanged': 400,
  'invalid-request': 400,
  'upstream-failed': 503,
  unknown: 500,
}

export const HOME_INSURANCE_ERROR_REASON: Record<
  HomeInsuranceAdapterError,
  string
> = {
  'lease-not-found': 'The lease was not found',
  'home-insurance-row-not-found': 'The lease has no home insurance row',
  'home-insurance-row-changed':
    'The home insurance row was changed by someone else. Read it again',
  'home-insurance-already-exists': 'The lease already has home insurance',
  'end-date-before-start': "The end date is before the row's first day",
  'end-date-unchanged': 'The row already ends on that date',
  'invalid-request': 'The request is invalid',
  'upstream-failed': 'The leasing system could not be read or written',
  unknown: 'Unexpected response from the leasing service',
}

/** Answers a failed home insurance call with leasing's status and code. */
export const sendHomeInsuranceFailure = (
  ctx: { status: number; body: unknown },
  failure: { err: HomeInsuranceAdapterError; detail?: string },
  metadata: object
) => {
  ctx.status = HOME_INSURANCE_ERROR_STATUS[failure.err]
  ctx.body = {
    error: failure.err,
    reason: failure.detail || HOME_INSURANCE_ERROR_REASON[failure.err],
    ...metadata,
  }
}

export const HOME_INSURANCE_LIST_ERROR_STATUS: Record<
  HomeInsuranceListRouteErrorCode,
  number
> = {
  'invalid-query': 400,
  'cache-warming': 503,
  'upstream-failed': 503,
  unknown: 500,
}

// Sent with cache-warming when leasing gave no Retry-After of its own.
export const HOME_INSURANCE_LIST_RETRY_AFTER_SECONDS = '30'

const BLANK_CONTACT_FIELDS: HomeInsuranceContactFields = {
  fullName: null,
  nationalIdNumber: null,
  phoneNumber: null,
  email: null,
}

/**
 * The person fields of a contact. All blank for a protected identity or a
 * missing contact: they are never taken from anywhere but the contacts
 * service.
 */
export const toHomeInsuranceContactFields = (
  contact: Contact | undefined
): HomeInsuranceContactFields => {
  if (!contact || contact.protectedIdentity) return BLANK_CONTACT_FIELDS

  const communication = {
    phoneNumber: primaryPhoneNumber(contact),
    email: primaryEmailAddress(contact),
  }

  if (contact.type === 'organisation') {
    return {
      fullName: contact.organisation.name,
      nationalIdNumber: contact.organisation.organisationNumber,
      ...communication,
    }
  }

  return {
    fullName: contact.personal.fullName,
    nationalIdNumber: contact.personal.nationalId,
    ...communication,
  }
}

/**
 * Fills in each row's person fields from the contacts service, in one batch.
 * Fails closed: when the lookup fails every row gets blank person fields,
 * and so does a row whose contact has a protected identity or is missing.
 */
export const withHomeInsuranceContacts = async (
  items: leasing.HomeInsuranceListItem[],
  deps?: ContactLookupDeps
): Promise<HomeInsuranceListItemWithContact[]> => {
  const contactFor = await lookUpContactsFailClosed(
    items.map((item) => item.contactCode),
    { includePhone: true, includeEmail: true },
    'withHomeInsuranceContacts',
    deps
  )

  return items.map((item) => ({
    ...item,
    ...toHomeInsuranceContactFields(contactFor(item.contactCode)),
  }))
}

/**
 * The query to send to leasing. A personnummer in q is looked up in the
 * contacts service and sent as contactCodes instead, since leasing holds no
 * personnummer. A personnummer with no contact gives an empty contactCodes,
 * which matches nothing, and a failed lookup fails the request rather than
 * listing rows that do not belong to the person.
 */
export const toLeasingHomeInsuranceQuery = async (
  query: HomeInsuranceListQuery
): Promise<
  | { ok: true; query: leasing.HomeInsuranceListQueryParams }
  | { ok: false; err: 'upstream-failed' }
> => {
  const q = query.q?.trim()
  if (!q) return { ok: true, query: { ...query, q: undefined } }

  try {
    const resolution = await resolvePersonnummer(q)
    switch (resolution.kind) {
      case 'not-personnummer':
        return { ok: true, query: { ...query, q } }
      case 'found':
        return {
          ok: true,
          query: {
            ...query,
            q: undefined,
            contactCodes: [resolution.contactCode],
          },
        }
      case 'not-found':
        return {
          ok: true,
          query: { ...query, q: undefined, contactCodes: [] },
        }
      case 'failed':
        return { ok: false, err: 'upstream-failed' }
    }
  } catch (err: unknown) {
    logger.error(
      errorLogFields(err),
      'toLeasingHomeInsuranceQuery: contact lookup threw'
    )
    return { ok: false, err: 'upstream-failed' }
  }
}

/**
 * The client's query without page and limit, for the pagination links. q is
 * kept as the client sent it, not as the contact code it resolved to.
 */
export const homeInsuranceListLinkParams = (
  query: HomeInsuranceListQuery
): Record<string, string> => {
  const params: Record<string, string> = {
    rows: query.rows,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  }
  if (query.q) params.q = query.q
  if (query.status && query.status.length > 0)
    params.status = query.status.join(',')
  if (query.sameDate) params.sameDate = 'true'
  return params
}

/** A row of the staff list as a row of the Länsförsäkringar columns. */
export const toHomeInsuranceLfColumnValues = (
  item: HomeInsuranceListItemWithContact
): HomeInsuranceLfColumnValues => ({
  leaseId: item.leaseId,
  nationalIdNumber: item.nationalIdNumber,
  fullName: item.fullName,
  address: item.address,
  postalCode: item.postalCode,
  city: item.city,
  numberOfRooms: item.numberOfRooms,
  squareMeters: item.squareMeters,
  leaseFromDate: item.leaseFromDate,
  leaseToDate: item.leaseToDate,
  phoneNumber: item.phoneNumber,
  email: item.email,
  rowFromDate: item.rowFromDate,
  rowToDate: item.rowToDate,
  monthlyAmount: item.monthlyAmount,
  rentalObjectCode: item.rentalObjectCode,
  leaseStatus: item.leaseStatus,
  articleText: item.articleText,
})
