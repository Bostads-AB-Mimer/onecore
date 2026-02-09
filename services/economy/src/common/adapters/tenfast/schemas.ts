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
      skvNummer: z.number().nullable(),
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
  roundingAmount: z.number(),
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
  recipientContactCode: z.string().optional(),
  recipientName: z.string().optional(),
  contractCode: z.string().optional(),
  //id: z.string(),
})

export const TenfastInvoiceSnapshotSchema = z.object({
  hyresvard: z.object({
    originalId: z.string(),
    displayName: z.string(),
    idbeteckning: z.string(),
    isCompany: z.boolean(),
    postadress: z.string(),
    postnummer: z.string(),
    stad: z.string(),
    phone: z.string(),
    momsnummer: z.string(),
    paymentMethods: z.any(),
    logo: z.any(),
  }),
  hyresgaster: z.array(
    z.object({
      originalId: z.string(),
      displayName: z.string(),
      idbeteckning: z.string(),
      isCompany: z.boolean(),
      fakturaMottagare: z.object({
        name: z.string().nullable(),
        idbeteckning: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        postadress: z.string().nullable(),
        postnummer: z.string().nullable(),
        godMan: z.boolean(),
      }),
      postadress: z.string(),
      postnummer: z.string(),
      stad: z.string(),
      phone: z.string(),
    })
  ),
  avtal: z.array(
    z.object({
      originalId: z.string(),
      externalId: z.string(),
      version: z.number(),
      reference: z.number(),
    })
  ),
  hyresobjekt: z.array(
    z.object({
      avtalId: z.string(),
      originalId: z.string(),
      externalId: z.string(),
      postadress: z.string(),
      postnummer: z.string(),
      skvNummer: z.number().nullable(),
      nummer: z.string(),
      stad: z.string(),
    })
  ),
})

// Getting invoices by OCR from Tenfast returns a list of full Lease objects,
export const TenfastInvoicesByOcrResponseSchema = z.object({
  records: z.array(
    TenfastInvoiceSchema.extend({
      avtal: z.array(TenfastLeaseSchema),
      snapshot: TenfastInvoiceSnapshotSchema.optional(),
    }).transform((data) => ({
      ...data,
      avtal: data.avtal.map((x) => x.id),
      recipientId: data.snapshot?.hyresgaster[0]?.originalId,
      contractCode: data.snapshot?.avtal[0]?.externalId,
      recipientContactCode: '', // TODO: Add
      recipientName:
        data.snapshot?.hyresgaster[0]?.displayName ??
        data.avtal[0]?.hyresgaster[0]?.displayName,
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

export const TenfastRentArticleSchema = z.object({
  includeInContract: z.boolean(),
  _id: z.string(),
  label: z.string(),
  type: z.string(),
  accountNr: z.string().nullable(),
  createdAt: z.string(),
  hyresvard: z.string(),
  code: z.string(),
  title: z.string(),
})

export type TenfastRentArticle = z.infer<typeof TenfastRentArticleSchema>
