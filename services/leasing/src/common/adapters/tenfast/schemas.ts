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

/*
{
  "hyresgaster": [
    "67eb3cdbc334e091aa28f322"
  ],
  "hyresobjekt": [
    "67eb8af5545c8f1195bef2e6"
  ],
  "avtalsbyggare": true,
  "hyror": [
    {
      "amount": 287.17,
      "vat": 0,
      "article": "67eb8aea545c8f1195bea0ba",
      "label": "Hyra för bilplats"
    }
  ],
  "startDate": "2025-11-05",
  "endDate": "2026-02-06",
  "aviseringsTyp": "none",
  "uppsagningstid": "1m",
  "forskottAvisering": "1m",
  "betalningsOffset": "1d",
  "betalasForskott": false,
  "vatEnabled": true,
  "originalTemplate": "6012d3ffe095ca4e36525235",
  "template": {
        "_id": "6012d3ffe095ca4e36525235",
        "hyresvardar": [
            "6344b398b63ff59d5bde8257"
        ],
        "public": false,
        "official": true,
        "category": "bostad",
        "addons": [
            "6012cc0fe095ca4e365245b6",
            "6012cba5e095ca4e365245ab",
            "6012cc29e095ca4e365245be",
            "6012c95be095ca4e36524218",
            "6012ce8ce095ca4e365248fb",
            "6012d265e095ca4e36524f7b",
            "6012cf74e095ca4e36524c24",
            "63640e5bdfd0610fa9f82f1f",
            "6012c622e095ca4e36523edb",
            "6012c7cee095ca4e36523ee1",
            "6012d2bbe095ca4e36524f81",
            "60108d9b8cc47e71c61ce5e7",
            "6012cfb6e095ca4e36524c34"
        ],
        "name": "Hyresavtal Bostad",
        "createdBy": null,
        "createdAt": "2021-01-28T15:10:55.809Z",
        "updatedAt": "2024-05-15T07:18:53.691Z",
        "__v": 17,
        "updatedBy": null,
        "type": "official",
        "id": "6012d3ffe095ca4e36525235"
    },
  "method": "manual",
  "aviseringsFrekvens": "1m"
}*/
export const TenfastCreateLeaseRequestSchema = z.object({
  hyresgaster: z.array(z.string()),
  hyresobjekt: z.array(z.string()),
  avtalsbyggare: z.boolean(),
  hyror: z.array(
    z.object({
      amount: z.number(),
      vat: z.number(),
      article: z.string(),
      label: z.string(),
    })
  ),
  startDate: z.string(),
  endDate: z.string(),
  aviseringsTyp: z.string(),
  uppsagningstid: z.string(),
  forskottAvisering: z.string(),
  betalningsOffset: z.string(),
  betalasForskott: z.boolean(),
  vatEnabled: z.boolean(),
  originalTemplate: z.string(),
  template: z.object({}),
  method: z.string(),
  aviseringsFrekvens: z.string(),
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
export type TenfastCreateLeaseRequest = z.infer<
  typeof TenfastCreateLeaseRequestSchema
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
