import { z } from 'zod'

export const TenfastLeaseSchema = z.object({
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

export const TenfastInvoiceRowSchema = z.object({
  amount: z.number(),
  vat: z.number(),
  from: z.string().optional(),
  to: z.string().nullable().optional(),
  hyresobjekt: z.string().optional(),
  article: z.string().nullable(),
  label: z.string().nullable(),
  accountingRows: z.array(z.any()),
  consolidationLabel: z.string().nullable().optional(),
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

// Getting invoices by OCR from Tenfast returns a list of full Lease objects,
export const TenfastInvoicesByOcrResponseSchema = z.object({
  records: z.array(
    TenfastInvoiceSchema.extend({
      avtal: z.array(TenfastLeaseSchema),
    }).transform((data) => ({
      ...data,
      avtal: data.avtal.map((x) => x.id),
    }))
  ),
})

export const TenfastInvoicesByTenantIdResponseSchema =
  z.array(TenfastInvoiceSchema)

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

export const TenfastTenantByContactCodeResponseSchema = z.object({
  records: z.array(TenfastTenantSchema),
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

export type TenfastLease = z.infer<typeof TenfastLeaseSchema>

export const TenfastRentArticleSchema = z.record(z.string(), z.any())

export type TenfastRentArticle = z.infer<typeof TenfastRentArticleSchema>
