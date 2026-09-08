import { logger } from '@onecore/utilities'

import {
  ContactWriteError,
  CreateContactInput,
} from '@src/adapters/contact-writer'
import { AdapterResult } from '@src/adapters/types'
import { XpandSoapConfig } from '@src/common/config'
import { getBirthDateFromNationalId } from '@src/domain/national-id'
import { el, elOpt, envelope, wrap } from './xml'
import { SoapBody } from './client'

/**
 * WS-Addressing action and body wrapper for the create operation.
 *
 * Both are taken verbatim from the WSDL. They are not derivable from each
 * other or from the operation name — this operation uses the interface name
 * with an `I` prefix in the action, while the wrapper element is named
 * differently again. See the note on `envelope`.
 */
export const CREATE_APPLICANT_ACTION =
  'http://incit.xpand.eu/service/ICreateApplicant08352/CreateApplicant08352'
export const CREATE_APPLICANT_WRAPPER = 'CreateApplicantRequest08352'

/**
 * Xpand's phone type keys and their display captions.
 *
 * Both halves are sent; Xpand does not derive the caption from the key. These
 * are the exact values mimer.nu's own registration writes, so a contact created
 * here is indistinguishable from a self-registered one.
 */
const PHONE_TYPES = {
  mobile: { key: 'mobil', caption: 'Mobiltelefon' },
  home: { key: 'telhem', caption: 'Telefon (hem)' },
  work: { key: 'telarbete', caption: 'Telefon (arbete)' },
} as const

const EMAIL_TYPE = { key: 'mail', caption: 'E-post' } as const

/** `AddressKind.Invoice`. Enums serialise by name, not by their numeric value. */
const ADDRESS_KIND_INVOICE = 'Invoice'

/** `PreferredContactMethod.Email`. */
const PREFERRED_CONTACT_METHOD_EMAIL = 'Email'

/** Xpand contact category `P` — a natural person. */
const CONTACT_CATEGORY_PERSON = 'P'

/**
 * Everything inside `MainApplicant08352` consists of data-contract members and
 * belongs to the `data` namespace — see xml.ts for why the wrong namespace
 * fails silently. Only the request-wrapper members (`CompanyCode`,
 * `MainApplicant08352`, `MessageCulture`) stay in `inc`.
 */
const dataEl = (name: string, value: string | number | boolean) =>
  el(name, value, 'data')
const dataElOpt = (
  name: string,
  value: string | number | boolean | null | undefined
) => elOpt(name, value, 'data')
const dataWrap = (name: string, children: string) =>
  wrap(name, children, 'data')

/**
 * Pinned to Swedish time rather than the process time zone: the service runs
 * in a UTC container, so an address created late in the Swedish evening would
 * otherwise be stamped with the previous calendar day. An explicit time zone
 * also makes the result independent of where tests run.
 */
const SWEDISH_TIME_ZONE = 'Europe/Stockholm'

/** sv-SE formats as YYYY-MM-DD. */
const swedishDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Midnight of the Swedish calendar date of `now`, serialised as
 * DataContractSerializer expects — the FromDate mimer.nu stamps on new
 * addresses.
 */
const stockholmMidnight = (now: Date): string =>
  `${swedishDate.format(now)}T00:00:00`

/**
 * Derives the birth date from a personal identity number.
 *
 * Xpand accepts a null birth date, but mimer.nu always supplies one, and a
 * contact without it reads as incomplete in the Xpand client.
 *
 * Delegates the reading of the number itself — a coordination number's day is
 * offset by 60 and cannot be sliced out of the digits.
 */
const birthDateFrom = (nationalId: string): string | null => {
  const birthDate = getBirthDateFromNationalId(nationalId)
  return birthDate && `${birthDate}T00:00:00`
}

/**
 * Renders one `Address`. Members alphabetical, per the contract's ordering.
 *
 * Only the fields mimer.nu populates are emitted: Street, StreetNumber,
 * PostalArea, Region and Suffix are deliberately left out, and the whole
 * street line goes in PostalAddress. Emitting them empty would set them to
 * blank rather than leaving them at their default.
 */
const renderAddress = (
  address: CreateContactInput['addresses'][number],
  now: Date
) =>
  dataWrap(
    'Address',
    [
      dataEl('AddressType', ADDRESS_KIND_INVOICE),
      dataEl('City', address.city.toUpperCase()),
      dataEl('Country', (address.country ?? 'SVERIGE').toUpperCase()),
      dataEl('FromDate', stockholmMidnight(now)),
      dataEl('PostalAddress', address.street),
      // The contract has no CareOf member; PostalAddress2 is where mimer.nu's
      // own registration puts the c/o line, so we follow that convention.
      dataElOpt('PostalAddress2', address.careOf),
      dataEl('ZipCode', address.zipCode),
    ].join('')
  )

/** Renders one `Email`. Members alphabetical. */
const renderEmail = (
  email: CreateContactInput['emailAddresses'][number]
): string =>
  dataWrap(
    'Email',
    [
      dataEl('Address', email.emailAddress),
      dataEl('ElectronicAddressTypeCaption', EMAIL_TYPE.caption),
      dataEl('ElectronicAddressTypeKey', EMAIL_TYPE.key),
      dataEl('IsStandard', email.isPrimary),
    ].join('')
  )

/** Renders one `Phone`. Members alphabetical — IsStandard sorts first. */
const renderPhone = (
  phone: CreateContactInput['phoneNumbers'][number]
): string =>
  dataWrap(
    'Phone',
    [
      dataEl('IsStandard', phone.isPrimary),
      dataEl('PhoneNumber', phone.phoneNumber),
      dataEl('PhoneTypeCaption', PHONE_TYPES[phone.type].caption),
      dataEl('PhoneTypeKey', PHONE_TYPES[phone.type].key),
    ].join('')
  )

/** Renders `SystemUserCredentials`. Members alphabetical. */
const renderCredentials = (
  credentials: CreateContactInput['credentials']
): string =>
  dataWrap(
    'Credentials',
    [
      dataEl('Email', credentials.email),
      dataEl('Name', credentials.name),
      dataEl('Password', credentials.password),
    ].join('')
  )

/**
 * Builds the `CreateApplicant08352` request envelope.
 *
 * ELEMENT ORDER IS LOAD-BEARING. WCF's DataContractSerializer expects members
 * base-class-first, then alphabetically within each level of the inheritance
 * chain, and rejects a re-ordered body with a validation failure rather than a
 * useful error. The chain here is:
 *
 *   EntityDataContractBase
 *     -> ContactRoleBaseDataContractOfApplicantEntity  (67 members)
 *     -> ApplicantDataContract                         (Address, ApplicantNoteWeb, Credentials, Details)
 *     -> CreateApplicantDataContract08352              (19 members)
 *
 * The fields below are the subset we populate, kept in exactly that order. No
 * member on the contract is marked `EmitDefaultValue=false`, so omitting the
 * ~66 fields we do not set is safe — only the relative order of what we send
 * matters. Do not reorder these lines to group them logically.
 */
export const buildCreateApplicantEnvelope = (
  config: XpandSoapConfig,
  input: CreateContactInput,
  now: Date = new Date()
): string => {
  const applicant = [
    // --- ContactRoleBaseDataContractOfApplicantEntity ---
    dataWrap(
      'Addresses',
      input.addresses.map((address) => renderAddress(address, now)).join('')
    ),
    dataElOpt('BirthDate', birthDateFrom(input.nationalId)),
    dataEl('CivicNumber', input.nationalId),
    dataEl('ContactCategoryCode', CONTACT_CATEGORY_PERSON),
    // Required by the contract (no minOccurs="0") but allocated by Xpand on
    // create — sent empty. Omitting it fails with "Expecting element
    // 'ContactCode'"; it is one of only three required members alongside
    // CivicNumber and ContactCategoryCode.
    dataEl('ContactCode', ''),
    dataEl('FirstName', input.firstName),
    dataEl('IsActive', true),
    dataEl('IsNaturalPerson', true),
    dataEl('IsPresystemLocked', false),
    dataEl('LastName', input.lastName),
    dataEl('PreferredContactMethod', PREFERRED_CONTACT_METHOD_EMAIL),

    // --- ApplicantDataContract ---
    renderCredentials(input.credentials),

    // --- CreateApplicantDataContract08352 ---
    dataWrap('EmailAddresses', input.emailAddresses.map(renderEmail).join('')),
    dataWrap('PhoneNumbers', input.phoneNumbers.map(renderPhone).join('')),
  ].join('')

  // The request wrapper carries explicit Order attributes, so this order is
  // stated by the contract rather than inferred: CoApplicant08352 (omitted),
  // CompanyCode, MainApplicant08352, MessageCulture.
  const body = [
    el('CompanyCode', config.companyCode),
    wrap('MainApplicant08352', applicant),
    el('MessageCulture', config.messageCulture),
  ].join('')

  return envelope({
    action: CREATE_APPLICANT_ACTION,
    wrapper: CREATE_APPLICANT_WRAPPER,
    url: config.url,
    body,
  })
}

/** Field-level validation errors, when Xpand supplies them. */
const isTrue = (value: unknown): boolean =>
  value === true || String(value).trim().toLowerCase() === 'true'

const asText = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number') return String(value)
  return undefined
}

/**
 * Interprets a `CreateNewEntityResult`.
 *
 * A successful create returns the generated customer number (e.g. `P069077`)
 * in `ObjectDescription`. A success without one is treated as a malformed
 * response rather than a failure: the contact exists but we do not know its
 * code, and the caller must recover it instead of retrying — a retry would
 * either duplicate or be rejected by the duplicate check.
 */
export const parseCreateApplicantResponse = (
  body: SoapBody
): AdapterResult<{ contactCode: string }, ContactWriteError> => {
  const result = body['CreateNewEntityResult']

  if (typeof result !== 'object' || result === null) {
    return { ok: false, err: 'xpand-malformed-response' }
  }

  const fields = result as Record<string, unknown>

  if (!isTrue(fields['Success'])) {
    // `Message` is the only reliable description of what went wrong, and it is
    // what the caseworker sees. `ResultKind` classifies the failure reliably
    // and `ErrorInformation` occasionally names the offending field, so both
    // are logged here — no caller reads them, and Xpand's own registration
    // flow ignores them too.
    logger.error(
      {
        resultKind: asText(fields['ResultKind']),
        errorInformation: fields['ErrorInformation'],
      },
      'parseCreateApplicantResponse: rejected by Xpand'
    )

    return {
      ok: false,
      err: 'xpand-rejected',
      detail: asText(fields['Message']) ?? asText(fields['ResultKind']),
    }
  }

  const contactCode = asText(fields['ObjectDescription'])
  if (!contactCode) {
    return { ok: false, err: 'xpand-malformed-response' }
  }

  return { ok: true, data: { contactCode } }
}
