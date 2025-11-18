import { z } from 'zod'

export const TenfastInvoiceRowSchema = z.object({
  amount: z.number(),
  vat: z.number(),
  from: z.string(),
  to: z.string().nullable(),
  article: z.string().nullable(),
  label: z.string().nullable(),
  accountingRows: z.array(z.any()),
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

/*{
            "tags": [],
            "comments": [],
            "_id": "67eb8af5545c8f1195bef2e6",
            "hyresvard": "6344b398b63ff59d5bde8257",
            "externalId": "941-721-00-0014",
            "roomCount": null,
            "typ": "parkering",
            "parkeringType": "personbil",
            "originalType": "Parkeringsplats med el",
            "hyra": 287.17,
            "hyror": [],
            "createdAt": "2025-04-01T06:43:01.357Z",
            "nummer": "19105",
            "postadress": "Testvägen 3",
            "postnummer": "72212",
            "stad": "Västerås",
            "avtalStates": [
                "reserved",
                "vacant"
            ],
            "lastStateChanged": "2025-11-05T12:46:51.251Z",
            "updatedAt": "2025-11-05T12:46:51.251Z",
            "images": [],
            "files": [],
            "displayName": "Testvägen 3 - nr. 19105",
            "subType": "Personbil",
            "states": [
                "reserved",
                "vacant"
            ]
        }*/

export const TenfastRentalObjectSchema = z.object({
  // tags: z.array(z.any()),
  // comments: z.array(z.any()),
  _id: z.string(),
  // hyresvard: z.string(),
  // externalId: z.string(),
  // roomCount: z.number().nullable(),
  // typ: z.string(), //gör typ??
  // parkeringType: z.string().nullable(),
  // originalType: z.string(),
  hyra: z.number(),
  article: z.string(),
  hyror: z.array(z.any()), //gör hyror??
  // createdAt: z.string(), // gör datum??
  // nummer: z.string(),
  // postadress: z.string(),
  // postnummer: z.string(),
  // stad: z.string(),
  // avtalStates: z.array(z.string()),
  // lastStateChanged: z.string(), //gör datum??
  // updatedAt: z.string(), //gör datum??
  // images: z.array(z.any()),
  // files: z.array(z.any()),
  // displayName: z.string(),
  // subType: z.string(),
  // states: z.array(z.string()),
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
