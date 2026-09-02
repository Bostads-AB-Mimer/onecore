import { WaitingListType } from '@onecore/types'
import { z } from 'zod'

/**
 * The customer type split is Privatperson vs Företagskund, mirroring how the
 * business reads Xpand's P/F series. Only 'person' can be created today —
 * a company needs its contact category converted to F after creation, which
 * the write path does not do yet. The constant exists so the dialog can show
 * the company path as coming, not hide it.
 */
export const CUSTOMER_TYPES = ['person', 'company'] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]

export const customerTypeLabels: Record<CustomerType, string> = {
  person: 'Privatperson',
  company: 'Företagskund',
}

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
 * Format check only. The server validates the checksum and is the authority —
 * this exists to catch typos before a round trip, not to duplicate that rule.
 */
const NATIONAL_ID_PATTERN = /^(19|20)?\d{6}[-+]?\d{4}$/

const applicationProfileSchema = z.object({
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

const baseSchema = z.object({
  waitingLists: z.array(z.nativeEnum(WaitingListType)).default([]),
  nationalId: z
    .string()
    .min(1, 'Ange personnummer')
    .regex(NATIONAL_ID_PATTERN, 'Personnumret ser inte giltigt ut'),
  firstName: z.string().min(1, 'Ange förnamn').max(50),
  lastName: z.string().min(1, 'Ange efternamn').max(50),
  street: z.string().min(1, 'Ange gatuadress'),
  zipCode: z.string().min(1, 'Ange postnummer'),
  city: z.string().min(1, 'Ange ort'),
  careOf: z.string().optional(),
  emailAddress: z.string().email('Ange en giltig e-postadress'),
  // Required to mirror mina-sidor, where at least one phone number is
  // mandatory at registration. Trimmed before the length check: the request
  // body trims it too, so whitespace alone would otherwise pass validation and
  // then be dropped silently, defeating the rule.
  phoneNumber: z.string().trim().min(1, 'Ange telefonnummer'),
})

/**
 * Household data is an optional add-on, mirroring mina-sidor where the
 * application profile is collected later in the application flow — not at
 * registration. Unchecked, the customer is created without a profile and it
 * can be completed later from the customer card.
 */
export const createContactFormSchema = z.discriminatedUnion(
  'withApplicationProfile',
  [
    baseSchema.extend({
      withApplicationProfile: z.literal(true),
      applicationProfile: applicationProfileSchema,
    }),
    baseSchema.extend({ withApplicationProfile: z.literal(false) }),
  ]
)

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
  'invalid-request': 'Något i formuläret kunde inte tolkas.',
  'xpand-rejected': 'Xpand nekade registreringen.',
  // Our request was malformed — nothing a caseworker can act on, so the
  // technical fault text stays in the logs and never reaches this message.
  'xpand-fault':
    'Ett tekniskt fel uppstod i kontakten med Xpand. Kontrollera om kunden skapades innan du försöker igen.',
  'xpand-auth-failed': 'ONECore saknar behörighet att skapa kunder i Xpand.',
  'xpand-malformed-response':
    'Xpand svarade med något vi inte kunde tolka. Kontrollera om kunden ändå skapades innan du försöker igen.',
  'xpand-unavailable':
    'Xpand går inte att nå just nu. Ingen kund har skapats — försök igen senare.',
  'write-backend-not-configured':
    'Kundregistrering är inte konfigurerad i den här miljön.',
  'contacts-service-error': 'Ett oväntat fel uppstod. Ingen kund har skapats.',
}

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
  code === 'duplicate-contact' && detail && /^[A-Z]\d+$/.test(detail.trim())
    ? detail.trim()
    : undefined

export const createContactErrorMessage = (
  code: string | undefined,
  detail?: string
): string => {
  const message =
    (code && createContactErrorMessages[code]) ??
    'Ett oväntat fel uppstod. Ingen kund har skapats.'

  // Xpand's own validation text is the only thing that says which field is
  // wrong, so pass it through rather than hiding it behind our summary.
  return code === 'xpand-rejected' && detail ? `${message} ${detail}` : message
}

/**
 * Maps validated form values to the `POST /v1/contacts` request body.
 *
 * Empty optional fields are omitted or sent as null rather than as empty
 * strings — the API treats "not provided" differently from "provided empty".
 * Landlord and housing description are nulled when the chosen housing type
 * makes them meaningless, so stale input from a previous choice never leaks
 * into the request.
 */
export const toCreateContactRequestBody = (values: CreateContactFormValues) => {
  const careOf = values.careOf?.trim()
  const phoneNumber = values.phoneNumber?.trim()

  return {
    nationalId: values.nationalId.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
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
    waitingLists: values.waitingLists,
    ...(values.withApplicationProfile
      ? {
          applicationProfile: {
            numAdults: values.applicationProfile.numAdults,
            numChildren: values.applicationProfile.numChildren,
            housingType: values.applicationProfile.housingType,
            housingTypeDescription: requiresHousingDescription(
              values.applicationProfile.housingType
            )
              ? values.applicationProfile.housingTypeDescription?.trim() || null
              : null,
            landlord: requiresLandlord(values.applicationProfile.housingType)
              ? values.applicationProfile.landlord?.trim() || null
              : null,
            housingReference: {
              phone:
                values.applicationProfile.housingReference.phone?.trim() ||
                null,
              email:
                values.applicationProfile.housingReference.email?.trim() ||
                null,
            },
          },
        }
      : {}),
  }
}
