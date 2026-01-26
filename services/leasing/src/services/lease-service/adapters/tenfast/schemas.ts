import { format } from 'date-fns'
import { z } from 'zod'

const YearMonthDayStringSchema = z.string().brand<'yyyy-mm-dd'>()

export type YearMonthDayString = z.infer<typeof YearMonthDayStringSchema>

export function toYearMonthDayString(date: Date): YearMonthDayString {
  return YearMonthDayStringSchema.parse(format(date, 'yyyy-MM-dd'))
}

// TODO: Add explanation
export const TenfastInvoiceRowSchema = z.object({
  amount: z.number(),
  vat: z.number(), //moms, percentage in decimal form 0.25 = 25%
  from: YearMonthDayStringSchema.optional().nullable(),
  to: YearMonthDayStringSchema.optional().nullable(),
  article: z.string().nullable(),
  label: z.string().nullable(),
  _id: z.string(),
})

export const TenfastTenantSchema = z.object({
  name: z.object({
    first: z.string(),
    last: z.string(),
  }),
  moms: z.number(),
  alternatePhones: z.array(z.any()),
  comments: z.array(z.any()),
  onlineInboxes: z.record(z.any()),
  signeringsMetod: z.string(),
  _id: z.string(),
  hyresvard: z.string(),
  isCompany: z.boolean(),
  phone: z.string(),
  idbeteckning: z.string(),
  postadress: z.string(),
  postnummer: z.string(),
  stad: z.string(),
  externalId: z.string(),
  borgenarer: z.array(z.any()),
  firmatecknare: z.array(z.any()),
  displayName: z.string(),
})

export const TenfastRentalObjectSchema = z.object({
  // Required fields
  _id: z.string(),
  externalId: z.string(),
  hyra: z.number(), //total hyra inklusive moms
  hyraVat: z.number(), // total moms pa hyran
  hyraExcludingVat: z.number(), // hyran exklusive moms
  hyror: z.array(TenfastInvoiceRowSchema),
  contractTemplate: z.string().optional(),

  // Reference fields (can be IDs or populated objects)
  hyresvard: z.union([z.string(), z.any()]).optional(),
  fastighet: z.union([z.string(), z.any()]).nullish(),

  // Address and location
  nummer: z.union([z.string(), z.number()]).nullish(),
  postadress: z.string().nullish(),
  postnummer: z.string().nullish(),
  stad: z.string().nullish(),
  stadsdel: z.string().nullish(),
  skvNummer: z.union([z.string(), z.number()]).nullish(),
  district: z.string().nullish(),

  // Display and type information
  displayName: z.string().optional(),
  typ: z.string().optional(), // 'parkering', 'bostad', 'lokal'
  subType: z.string().optional(),
  lokalType: z.string().nullish(),
  bostadType: z.string().nullish(),
  parkeringType: z.string().nullish(),
  category: z.string().optional(),

  // Measurements
  kvm: z.number().nullish(),
  roomCount: z.number().nullish(),

  // State and metadata
  avtalStates: z.array(z.string()).optional(),
  lastStateChanged: z.string().optional(),
  states: z.array(z.any()).optional(),
  comments: z.array(z.any()).optional(),
  files: z.array(z.any()).optional(),
  images: z.array(z.any()).optional(),
  tags: z.array(z.any()).optional(),
  useCounter: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const TenfastTenantByContactCodeResponseSchema = z.object({
  records: z.array(TenfastTenantSchema),
})
export const TenfastRentalObjectByRentalObjectCodeResponseSchema = z.object({
  records: z.array(TenfastRentalObjectSchema),
})

export type TenfastInvoiceRow = z.infer<typeof TenfastInvoiceRowSchema>
export type TenfastTenant = z.infer<typeof TenfastTenantSchema>
export type TenfastTenantByContactCodeResponse = z.infer<
  typeof TenfastTenantByContactCodeResponseSchema
>
export type TenfastRentalObject = z.infer<typeof TenfastRentalObjectSchema>
export type TenfastRentalObjectByRentalObjectCodeResponse = z.infer<
  typeof TenfastRentalObjectByRentalObjectCodeResponseSchema
>

// TODO byt namn
export const TenfastContractSchema = z.object({
  _id: z.string(),
  hyresgaster: z.array(
    z.object({
      name: z.object({
        first: z.string(),
        last: z.string(),
      }),
      _id: z.string(),
      isCompany: z.boolean(),
      displayName: z.string(),
    })
  ),
  hyresobjekt: z.array(
    z.object({
      _id: z.string(),
      nummer: z.string(),
      postadress: z.string(),
      skvNummer: z.string().nullable(),
      displayName: z.string(),
      subType: z.string(),
      states: z.array(z.any()),
    })
  ),
  reference: z.number(),
  stage: z.string(),
  invitationsToRegister: z.array(z.any()),
  canDelete: z.boolean(),
  depositState: z.array(z.any()),
  id: z.string(),
})

export type TenfastContract = z.infer<typeof TenfastContractSchema>

export const TenfastLeaseTemplateSchema = z.object({
  _id: z.string(),
  hyresvardar: z.array(z.string()),
  public: z.boolean(),
  official: z.boolean(),
  category: z.string(),
  addons: z.array(z.any()),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  __v: z.number(),
  type: z.string(),
  id: z.string(),
})

export type TenfastLeaseTemplate = z.infer<typeof TenfastLeaseTemplateSchema>

export interface PreliminaryTerminationResponse {
  message: string
}
export const NotificationTypeSchema = z.enum([
  'physicalmail',
  'kivra',
  'email',
  'post',
  'none',
])

// Helper to handle optional date fields that might be empty strings, null, or undefined
const optionalDateField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (!val || val === '') return null
    return val
  })
  .pipe(z.coerce.date().nullable())

/**
 * This schema is a combination of what was found here:
 * https://tenfast-test-api.mimer.nu/docs -> schema "Avtal"
 * and what was found in the actual responses from Tenfast API.
 *
 * Currently there are several discrepancies between data model and actual response.
 * Some fields that I considered irrelevant at the time of writing are typed as unknown
 */
export const TenfastLeaseSchema = z.object({
  externalId: z.string(), // This is Onecore canonical lease id
  reference: z.number(),
  version: z.number(),
  originalData: z.unknown(),
  hyror: z.array(TenfastInvoiceRowSchema),
  simpleHyra: z.boolean(),
  startDate: z.coerce.date(),
  endDate: optionalDateField,
  aviseringsTyp: NotificationTypeSchema,
  uppsagningstid: z.string(),
  aviseringsFrekvens: z.string(),
  forskottAvisering: z.string(),
  betalningsOffset: z.string(),
  betalasForskott: z.boolean(),
  vatEnabled: z.boolean(),
  method: z.string(),
  file: z
    .object({
      key: z.string(),
      location: z.string(),
      originalName: z.string(),
    })
    .optional()
    .nullable(),
  bankidSigningEnabled: z.boolean(),
  bankidSignatures: z.array(z.string()),
  cancellation: z.object({
    cancelled: z.boolean(),
    doneAutomatically: z.boolean(),
    receivedCancellationAt: optionalDateField, // When TenFAST received the cancellation
    notifiedAt: optionalDateField, // When TenFAST notified the tenant about the cancellation
    handledAt: optionalDateField, // When TenFAST handled the cancellation i.e termination date
    handledBy: z.string().optional().nullable(), // Which TenFAST user handled the cancellation
    preferredMoveOutDate: optionalDateField, // When the tenant prefers to move out
    cancelledByType: z.string().optional().nullable(), // Who cancelled the lease, tenant or landlord
  }),
  deposit: z.object({
    ekoNotifications: z.array(z.any()),
  }),
  simplesignTermination: z
    .object({
      signatures: z.array(z.any()),
      allSigned: z.boolean().optional(),
      docId: z.string().optional(),
      sentAt: optionalDateField,
      signedAt: optionalDateField,
    })
    .optional(),
  id: z.string(),
  _id: z.string(),
  hyresvard: z.string(),
  hyresgaster: z.array(TenfastTenantSchema),
  hyresobjekt: z.array(TenfastRentalObjectSchema),
  invitations: z.array(
    z.object({
      _id: z.string(),
      email: z.string(),
      signedUpAt: z.string(),
      hyresgast: z.string(),
    })
  ),
  confirmedHyresgastInfo: z.array(z.string()),
  acceptedByHyresgast: z.boolean(),
  comments: z.array(z.string()),
  files: z.array(
    z.object({
      key: z.string(),
      location: z.string(),
      originalName: z.string(),
    })
  ),
  versions: z.unknown(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  startInvoicingFrom: optionalDateField,
  signedAt: optionalDateField, // When the lease was finalized as in tenant signed it or manually marked by mimer if offline sign.
  tags: z.array(z.unknown()),
})

export type TenfastLease = z.infer<typeof TenfastLeaseSchema>

// TODO: I'd like to scope all these under "tenfast" instead, i.e tenfast.Lease, tenfast.Tenant etc
