import { WaitingListType } from '@onecore/types'
import { z } from 'zod'

import type { CreateContactRequestBody } from '@/services/api/core/tenantService'

/**
 * Xpand's contact categories for legal persons, as the API defines them. The
 * letter is also the prefix of the contact code, which is how the business
 * tells contact types apart. They behave identically in this form — only the
 * label and the resulting prefix differ — so they share one set of fields.
 */
export type OrganisationCategory = NonNullable<
  Extract<CreateContactRequestBody, { type: 'organisation' }>['category']
>

/** Everything the caseworker can pick under "Typ av kund". */
export type ContactCategory = 'individual' | OrganisationCategory

/**
 * The runtime lists the dropdown renders, pinned to the API type: `satisfies`
 * rejects a letter the API does not know, and `contactCategoryLabels` below
 * fails to compile when the API knows one these lists lack.
 */
export const ORGANISATION_CATEGORIES = [
  'F',
  'I',
  'K',
  'L',
  'Ö',
  'S',
] as const satisfies ReadonlyArray<OrganisationCategory>

export const CONTACT_CATEGORIES = [
  'individual',
  ...ORGANISATION_CATEGORIES,
] as const satisfies ReadonlyArray<ContactCategory>

export const contactCategoryLabels: Record<ContactCategory, string> = {
  individual: 'Privatperson',
  F: 'Företag',
  I: 'Intern',
  K: 'Kommunal',
  L: 'Landsting',
  Ö: 'Övrig',
  S: 'Statlig',
}

export const isOrganisationCategory = (
  category: ContactCategory | undefined
): category is OrganisationCategory =>
  category !== undefined && category !== 'individual'

export const HOUSING_TYPES = [
  'LIVES_WITH_FAMILY',
  'LODGER',
  'RENTAL',
  'SUB_RENTAL',
  'OWNS_HOUSE',
  'OWNS_FLAT',
  'OWNS_ROW_HOUSE',
  'OTHER',
] as const
export type HousingType = (typeof HOUSING_TYPES)[number]

export const housingTypeLabels: Record<HousingType, string> = {
  LIVES_WITH_FAMILY: 'Bor med familj',
  LODGER: 'Inneboende',
  RENTAL: 'Hyresrätt',
  SUB_RENTAL: 'Andrahandskontrakt',
  OWNS_HOUSE: 'Äger hus',
  OWNS_FLAT: 'Äger lägenhet',
  OWNS_ROW_HOUSE: 'Äger radhus',
  OTHER: 'Övrigt',
}

/** Housing types where naming a landlord is meaningful. */
const RENTED_HOUSING_TYPES: ReadonlySet<string> = new Set([
  'RENTAL',
  'SUB_RENTAL',
])

export const requiresLandlord = (housingType: string | undefined): boolean =>
  !!housingType && RENTED_HOUSING_TYPES.has(housingType)

export const requiresHousingDescription = (
  housingType: string | undefined
): boolean => housingType === 'OTHER'

/**
 * Format checks only. The server validates the checksums and is the authority —
 * these exist to catch typos before a round trip, not to duplicate that rule.
 */
const NATIONAL_ID_PATTERN = /^(19|20)?\d{6}[-+]?\d{4}$/
const ORGANISATION_NUMBER_PATTERN = /^(16)?\d{6}-?\d{4}$/

const applicationProfileFieldsSchema = z.object({
  numAdults: z.coerce
    .number({ invalid_type_error: 'Ange antal vuxna' })
    .int()
    .min(1, 'Minst en vuxen'),
  numChildren: z.coerce
    .number({ invalid_type_error: 'Ange antal barn' })
    .int()
    .min(0),
  housingType: z.enum(HOUSING_TYPES, {
    required_error: 'Välj boendeform',
  }),
  housingTypeDescription: z.string().nullable().default(null),
  landlord: z.string().nullable().default(null),
  // Optional to mirror mina-sidor, where the reference is collected later in
  // the application flow — a caseworker rarely has it at registration time.
  housingReference: z.object({
    phone: z.string().optional(),
    email: z
      .string()
      .email('Ange en giltig e-postadress')
      .optional()
      .or(z.literal('')),
  }),
})

/**
 * Household data is an optional add-on, mirroring mina-sidor where the
 * application profile is collected later in the application flow — not at
 * registration. With `enabled` off the customer is created without a profile
 * and it can be completed later from the customer card; the other fields are
 * then neither validated nor sent, however the form happens to hold them.
 */
const applicationProfileSchema = z
  .discriminatedUnion('enabled', [
    applicationProfileFieldsSchema.extend({ enabled: z.literal(true) }),
    z.object({ enabled: z.literal(false) }),
  ])
  // Landlord and description are only meaningful for some housing types, and
  // for those they are required — mina-sidor blocks the same omission.
  .superRefine((profile, ctx) => {
    if (!profile.enabled) return

    if (requiresLandlord(profile.housingType) && !profile.landlord?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['landlord'],
        message: 'Ange hyresvärd',
      })
    }
    if (
      requiresHousingDescription(profile.housingType) &&
      !profile.housingTypeDescription?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['housingTypeDescription'],
        message: 'Beskriv boendet',
      })
    }
  })

/**
 * The queues offered at registration, in the order mina-sidor lists them.
 * Queue time starts at enrolment, so a missed queue costs real seniority.
 */
export const WAITING_LISTS: ReadonlyArray<{
  type: WaitingListType
  label: string
}> = [
  { type: WaitingListType.Housing, label: 'Bostad' },
  { type: WaitingListType.ParkingSpace, label: 'Bilplats' },
  { type: WaitingListType.Storage, label: 'Förråd' },
]

/** Contact details every kind of customer has. */
const contactDetailsSchema = z.object({
  street: z.string().min(1, 'Ange gatuadress'),
  zipCode: z.string().min(1, 'Ange postnummer'),
  city: z.string().min(1, 'Ange ort'),
  careOf: z.string().optional(),
  // Required for every kind: the web account provisioned alongside the
  // customer needs an address to reach them on.
  emailAddress: z.string().email('Ange en giltig e-postadress'),
  // Required to mirror mina-sidor, where at least one phone number is
  // mandatory at registration. Trimmed before the length check: the request
  // body trims it too, so whitespace alone would otherwise pass validation and
  // then be dropped silently, defeating the rule.
  phoneNumber: z.string().trim().min(1, 'Ange telefonnummer'),
})

/**
 * Discriminated on the category the caseworker picks. A private individual
 * is identified by personnummer and may join queues and carry a household
 * profile; every organisation category shares one arm — organisation number
 * and name, nothing else — since queues and household data are for housing
 * applicants only.
 */
export const createContactFormSchema = z.discriminatedUnion('category', [
  contactDetailsSchema.extend({
    category: z.literal('individual'),
    nationalId: z
      .string()
      .min(1, 'Ange personnummer')
      .regex(NATIONAL_ID_PATTERN, 'Personnumret ser inte giltigt ut'),
    firstName: z.string().min(1, 'Ange förnamn').max(50),
    lastName: z.string().min(1, 'Ange efternamn').max(50),
    waitingLists: z.array(z.nativeEnum(WaitingListType)).default([]),
    applicationProfile: applicationProfileSchema,
  }),
  contactDetailsSchema.extend({
    category: z.enum(ORGANISATION_CATEGORIES),
    organisationNumber: z
      .string()
      .min(1, 'Ange organisationsnummer')
      .regex(
        ORGANISATION_NUMBER_PATTERN,
        'Organisationsnumret ser inte giltigt ut'
      ),
    // Xpand stores the name in a single 100-character field.
    name: z.string().min(1, 'Ange namn').max(100, 'Högst 100 tecken'),
  }),
])

export type CreateContactFormValues = z.infer<typeof createContactFormSchema>
/** What the form holds before parsing — defaults and coercions not yet applied. */
export type CreateContactFormInput = z.input<typeof createContactFormSchema>

/**
 * Messages for the failures the API reports before anything is created.
 *
 * There is deliberately no message for a partial failure: once the customer
 * exists the API answers 201 and the warnings it returns are shown verbatim,
 * because they name which step needs completing.
 */
export const createContactErrorMessages: Record<string, string> = {
  'duplicate-contact': 'En kund med det här personnumret finns redan.',
  'invalid-national-id': 'Personnumret är inte giltigt.',
  'invalid-organisation-number': 'Organisationsnumret är inte giltigt.',
  'invalid-request': 'Något i formuläret kunde inte tolkas.',
  'xpand-rejected': 'Xpand nekade registreringen.',
  // Our request was malformed — nothing a caseworker can act on, so the
  // technical fault text stays in the logs and never reaches this message.
  'xpand-fault':
    'Ett tekniskt fel uppstod i kontakten med Xpand. Kontrollera om kunden skapades innan du försöker igen.',
  'xpand-auth-failed': 'ONECore saknar behörighet att skapa kunder i Xpand.',
  'xpand-malformed-response':
    'Xpand svarade med något vi inte kunde tolka. Kontrollera om kunden ändå skapades innan du försöker igen.',
  // A timeout can strike after Xpand has already written, so neither of the
  // transport errors may promise that nothing was created.
  'xpand-unavailable':
    'Xpand går inte att nå just nu. Kontrollera om kunden skapades innan du försöker igen.',
  'write-backend-not-configured':
    'Kundregistrering är inte konfigurerad i den här miljön.',
  'contacts-service-error':
    'Ett tekniskt fel uppstod. Kontrollera om kunden skapades innan du försöker igen.',
}

/** The duplicate message names the number the caseworker actually typed. */
const DUPLICATE_ORGANISATION_MESSAGE =
  'En kund med det här organisationsnumret finns redan.'

/**
 * A contact code: one letter and digits, e.g. `P069077` or `F069077`. Any
 * letter is accepted, not only the categories that can be created here — the
 * existing contact that blocks a create may carry a legacy prefix such as `O`.
 */
const CONTACT_CODE_PATTERN = /^[A-ZÖ]\d+$/

/**
 * The existing customer's contact code, when the failure was a duplicate.
 *
 * On `duplicate-contact` the API puts the existing contact code in `detail`, so
 * the caseworker can be sent straight to the customer that blocked the create
 * rather than having to search for them. Guarded by a shape check: `detail` is
 * free text for every other error code.
 */
export const duplicateContactCode = (
  code: string | undefined,
  detail: string | undefined
): string | undefined =>
  code === 'duplicate-contact' &&
  detail &&
  CONTACT_CODE_PATTERN.test(detail.trim())
    ? detail.trim()
    : undefined

export const createContactErrorMessage = (
  code: string | undefined,
  detail?: string,
  party: 'individual' | 'organisation' = 'individual'
): string => {
  if (code === 'duplicate-contact' && party === 'organisation') {
    return DUPLICATE_ORGANISATION_MESSAGE
  }

  const message =
    (code && createContactErrorMessages[code]) ??
    'Ett oväntat fel uppstod. Ingen kund har skapats.'

  // Xpand's own validation text is the only thing that says which field is
  // wrong, so pass it through rather than hiding it behind our summary.
  if (code === 'xpand-rejected' && detail) return `${message} ${detail}`

  // The service's own Swedish reason — "Kunden måste vara minst 16 år." says
  // far more than "Personnumret är inte giltigt." would.
  if (
    (code === 'invalid-national-id' ||
      code === 'invalid-organisation-number') &&
    detail
  ) {
    return detail
  }

  return message
}

/**
 * Maps validated form values to the `POST /v1/contacts` request body.
 *
 * Empty optional fields are omitted or sent as null rather than as empty
 * strings — the API treats "not provided" differently from "provided empty".
 * Landlord and housing description are nulled when the chosen housing type
 * makes them meaningless, so stale input from a previous choice never leaks
 * into the request. An organisation sends neither queues nor a profile.
 */
export const toCreateContactRequestBody = (values: CreateContactFormValues) => {
  const careOf = values.careOf?.trim()
  const phoneNumber = values.phoneNumber?.trim()

  const details = {
    addresses: [
      {
        ...(careOf ? { careOf } : {}),
        street: values.street.trim(),
        zipCode: values.zipCode.trim(),
        city: values.city.trim(),
      },
    ],
    emailAddresses: [
      { emailAddress: values.emailAddress.trim(), isPrimary: true },
    ],
    phoneNumbers: phoneNumber ? [{ phoneNumber, isPrimary: true }] : [],
  }

  if (values.category !== 'individual') {
    return {
      type: 'organisation' as const,
      category: values.category,
      organisationNumber: values.organisationNumber.trim(),
      name: values.name.trim(),
      ...details,
    }
  }

  const profile = values.applicationProfile

  return {
    type: 'individual' as const,
    nationalId: values.nationalId.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    ...details,
    waitingLists: values.waitingLists,
    ...(profile.enabled
      ? {
          applicationProfile: {
            numAdults: profile.numAdults,
            numChildren: profile.numChildren,
            housingType: profile.housingType,
            housingTypeDescription: requiresHousingDescription(
              profile.housingType
            )
              ? profile.housingTypeDescription?.trim() || null
              : null,
            landlord: requiresLandlord(profile.housingType)
              ? profile.landlord?.trim() || null
              : null,
            housingReference: {
              phone: profile.housingReference.phone?.trim() || null,
              email: profile.housingReference.email?.trim() || null,
            },
          },
        }
      : {}),
  }
}
