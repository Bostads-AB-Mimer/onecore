import { z } from 'zod'

export const TenfastInvoiceRowSchema = z.object({
  amount: z.number(),
  vat: z.number(), //moms, percentage in decimal form 0.25 = 25%
  from: z.string().optional(),
  to: z.string().optional().nullable(),
  article: z.string().nullable(),
  label: z.string().nullable(),
  _id: z.string(),
})

export const TenfastInvoiceSchema = z.object({
  interval: z.object({
    from: z.string(),
    to: z.string(),
  }),
  _id: z.string(),
  hyresvard: z.string(),
  avtal: z.array(z.string()),
  hyror: z.array(TenfastInvoiceRowSchema),
  vatEnabled: z.boolean(),
  propertyTax: z.boolean(),
  simpleHyra: z.boolean(),
  amount: z.number(),
  amountPaid: z.number(),
  acceptDiff: z.boolean(),
  aviseringsTyp: z.string(),
  expectedInvoiceDate: z.string(),
  due: z.string(),
  sentAutomatically: z.boolean(),
  partiell: z.boolean(),
  activatedAt: z.string().nullable(),
  emails: z.array(z.any()),
  ekoNotifications: z.array(z.any()),
  skipEmail: z.boolean(),
  markedAsLate: z.boolean(),
  reference: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  __v: z.number(),
  ocrNumber: z.string(),
  late: z.boolean(),
  state: z.string(),
  id: z.string(),
})

export const TenfastInvoicesByOcrResponseSchema = z.object({
  records: z.array(TenfastInvoiceSchema),
})

export const TenfastInvoicesByTenantIdResponseSchema = z.array(
  z.object({
    interval: z.object({
      from: z.string(),
      to: z.string(),
    }),
    _id: z.string(),
    hyresvard: z.string(),
    avtal: z.array(z.string()),
    hyror: z.array(TenfastInvoiceRowSchema),
    vatEnabled: z.boolean(),
    propertyTax: z.boolean(),
    simpleHyra: z.boolean(),
    amount: z.number(),
    amountPaid: z.number(),
    acceptDiff: z.boolean(),
    aviseringsTyp: z.string(),
    expectedInvoiceDate: z.string(),
    due: z.string(),
    sentAutomatically: z.boolean(),
    partiell: z.boolean(),
    activatedAt: z.string().nullable(),
    emails: z.array(z.any()),
    ekoNotifications: z.array(z.any()),
    skipEmail: z.boolean(),
    markedAsLate: z.boolean(),
    reference: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    __v: z.number(),
    ocrNumber: z.string(),
    late: z.boolean(),
    state: z.string(),
    id: z.string(),
  })
)

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
  _id: z.string(),
  externalId: z.string(),
  hyra: z.number(), //total hyra inklusive moms
  hyraVat: z.number(), // total moms pa hyran
  hyraExcludingVat: z.number(), // hyran exklusive moms
  hyror: z.array(TenfastInvoiceRowSchema),
})

export const TenfastTenantByContactCodeResponseSchema = z.object({
  records: z.array(TenfastTenantSchema),
})
export const TenfastRentalObjectByRentalObjectCodeResponseSchema = z.object({
  records: z.array(TenfastRentalObjectSchema),
})

export type TenfastInvoiceRow = z.infer<typeof TenfastInvoiceRowSchema>
export type TenfastInvoice = z.infer<typeof TenfastInvoiceSchema>
export type TenfastInvoicesByOcrResponse = z.infer<
  typeof TenfastInvoicesByOcrResponseSchema
>
export type TenfastInvoicesByTenantIdResponse = z.infer<
  typeof TenfastInvoicesByTenantIdResponseSchema
>
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
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  __v: z.number(),
  updatedBy: z.string().nullable(),
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
  endDate: z.coerce.date().nullable(),
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
    receivedCancellationAt: z.coerce.date().optional().nullable(), // When TenFAST received the cancellation
    notifiedAt: z.coerce.date().optional().nullable(), // When TenFAST notified the tenant about the cancellation
    handledAt: z.coerce.date().optional().nullable(), // When TenFAST handled the cancellation i.e termination date
    handledBy: z.string().optional().nullable(), // Which TenFAST user handled the cancellation
    preferredMoveOutDate: z.coerce.date().optional().nullable(), // When the tenant prefers to move out
  }),
  deposit: z.object({
    ekoNotifications: z.array(z.any()),
  }),
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
  startInvoicingFrom: z.coerce.date(),
  signedAt: z.coerce.date().nullable(), // When the lease was finalized as in tenant signed it or manually marked by mimer if offline sign.
  tags: z.array(z.unknown()),
})

export type TenfastLease = z.infer<typeof TenfastLeaseSchema>

// TODO: I'd like to scope all these under "tenfast" instead, i.e tenfast.Lease, tenfast.Tenant etc
