import { z } from 'zod'

// Handles '', null, undefined, Date, or ISO string — normalises to Date | null
export const optionalDateField = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((val) => (!val || val === '' ? null : val))
  .pipe(z.coerce.date().nullable())

const TenfastPartOfYearSchema = z.object({
  from: z.string(),
  to: z.string(),
})

const TenfastFileSchema = z.object({
  key: z.string(),
  location: z.string(),
  originalName: z.string(),
})

export const TenfastInvoiceRowSchema = z.object({
  amount: z.number(),
  vat: z.number(),
  from: z.string().optional(),
  to: z.string().nullable().optional(),
  hyresobjekt: z.string().optional(),
  article: z.string().nullable(),
  label: z.string().nullable(),
  accountingRows: z.array(z.any()).optional(),
  consolidationLabel: z.string().nullable().optional(),
  _id: z.string(),
})

export const TenfastRentalPropertySchema = z.object({
  hyresvard: z.string(),
  hyra: z.number(),
  hyraExcludingVat: z.number(),
  hyraVat: z.number(),
  hyror: z.array(TenfastInvoiceRowSchema),
  nummer: z.string(),
  skvNummer: z.number().nullable(),
  postnummer: z.string(),
  postadress: z.string(),
  commonName: z.string().optional(),
  stad: z.string(),
  stadsdel: z.string(),
  typ: z.string(),
  kvm: z.number(),
  roomCount: z.number().nullable(),
  bostadType: z.string().nullable(),
  parkeringType: z.string().nullable(),
  lokalType: z.string().nullable(),
  category: z.any(), // TODO ? ska vara string
  description: z.string().optional(),
  public: z.boolean().optional(),
  images: z.array(TenfastFileSchema),
  files: z.array(TenfastFileSchema),
  comments: z.array(z.string()),
  tags: z.array(z.string()),
  externalId: z.string(),
  useCounter: z.number(),
  contractTemplate: z.string().optional(),
  terminationTemplate: z.string().optional(),
  avtalStates: z.array(z.string()),
  states: z.array(z.string()),
  lastStateChanged: z.string(),
  rentFreePeriod: TenfastPartOfYearSchema.optional(),
  displayName: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date(),
})

export const TenfastLeaseSchema = z.object({
  _id: z.string(),
  id: z.string(),
  externalId: z.string(), // Onecore canonical lease id, e.g. "306-008-01-0201/02"
  stage: z.enum([
    'archived',
    'voided',
    'terminated',
    'active',
    'signingInProgress',
    'upcoming',
    'draft',
    'terminationScheduled',
    'preTermination',
  ]),
  startDate: z.coerce
    .date()
    .optional()
    .default(() => new Date()),
  endDate: optionalDateField,
  hyresgaster: z
    .array(
      z.object({
        name: z.object({
          first: z.string(),
          last: z.string(),
        }),
        _id: z.string(),
        isCompany: z.boolean(),
        displayName: z.string(),
      })
    )
    .min(1),
  hyresobjekt: z.array(TenfastRentalPropertySchema).min(1),
  reference: z.number(),
  invitationsToRegister: z.array(z.any()),
  canDelete: z.boolean(),
  depositState: z.array(z.any()),
})
export const TenfastInvoiceStateSchema = z.enum([
  'betald',
  'ny',
  'ej-avprickad',
  'forsenad',
  'delvis-betald',
  'krediterad',
  'anstand',
])

export type TenfastInvoiceState = z.infer<typeof TenfastInvoiceStateSchema>

export const TenfastInvoiceSchema = z.object({
  interval: z.object({
    from: z.string(),
    to: z.string(),
  }),
  _id: z.string(),
  hyresvard: z.string(),
  avtal: z.array(
    z.object({
      _id: z.string(),
      hyresobjekt: z
        .array(
          z.object({
            _id: z.string(),
            nummer: z.string(),
            skvNummer: z.number().nullable(),
            postadress: z.string(),
            externalId: z.string(),
            displayName: z.string(),
            subType: z.string(),
            states: z.string().array(),
          })
        )
        .min(1),
      hyresgaster: z
        .array(
          z.object({
            name: z.object({
              first: z.string(),
              last: z.string(),
            }),
            _id: z.string(),
            externalId: z.string(),
            company: z.string(),
            isCompany: z.boolean(),
            displayName: z.string(),
          })
        )
        .min(1),
      externalId: z.string(),
      reference: z.number(),
      stage: z.string(),
      canDelete: z.boolean(),
      canVoid: z.boolean(),
      id: z.string(),
    })
  ),
  hyror: TenfastInvoiceRowSchema.array(),
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
  reference: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  ocrNumber: z.string(),
  late: z.boolean(),
  state: TenfastInvoiceStateSchema,
})

export const TenfastRentalPropertySearchResponseSchema = z.object({
  records: z.array(TenfastRentalPropertySchema),
  next: z.string().nullable(),
  prev: z.string().nullable(),
  totalCount: z.number(),
})

export const TenfastLeaseSearchResponseSchema = z.object({
  records: z.array(TenfastLeaseSchema),
  next: z.string().nullable(),
  prev: z.string().nullable(),
  totalCount: z.number(),
})

// Getting invoices by OCR from Tenfast returns a list of full Lease objects,
export const TenfastInvoicesByOcrResponseSchema = z.object({
  records: TenfastInvoiceSchema.array(),
})

export const TenfastInvoicesByTenantIdResponseSchema =
  z.array(TenfastInvoiceSchema)

export const TenfastTenantSchema = z.object({
  _id: z.string(),
  hyresvard: z.string(),
  isCompany: z.boolean(),
  name: z.object({
    first: z.string(),
    last: z.string(),
  }),
  company: z.string().optional(),
  idbeteckning: z.string(),
  moms: z.number(),
  phone: z.string(),
  normalizedPhone: z.string().optional(),
  postadress: z.string(),
  careOfAddress: z.string().optional(),
  postnummer: z.string(),
  stad: z.string(),
  fortnoxSendMethod: z.string().nullable().optional(),
  invoiceEmail: z.string().optional(),
  user: z.string().optional(),
  borgenarer: z.array(
    z.object({
      idbeteckning: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
  ),
  firmatecknare: z.array(
    z.object({
      idbeteckning: z.string(),
      email: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
  ),
  fakturaMottagare: z
    .object({
      name: z.string().nullable().optional(),
      idbeteckning: z.string().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      postadress: z.string().nullable().optional(),
      postnummer: z.string().nullable().optional(),
      godMan: z.boolean().optional(),
    })
    .optional(),
  isTrustee: z.boolean().optional(),
  trustee: z
    .object({
      name: z.string().nullable().optional(),
      idbeteckning: z.string().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      postadress: z.string().nullable().optional(),
      postnummer: z.string().nullable().optional(),
    })
    .optional(),
  alternatePhones: z.array(z.string()),
  comments: z.array(z.any()),
  fortnoxId: z.string().nullable().optional(),
  externalId: z.string(),
  signeringsMetod: z.string(),
  displayName: z.string(),
  onlineInboxes: z.record(z.any()).optional(),
  archivedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const TenfastTenantByContactCodeResponseSchema = z.object({
  records: z.array(TenfastTenantSchema),
})

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

// Lean lease schema for the batch-get endpoint, where hyresgaster/hyresobjekt
// are returned as string IDs (not populated objects) unless requested via extra
// query params we don't need here.
export const TenfastBatchGetLeaseSchema = TenfastLeaseSchema.extend({
  hyresgaster: z.array(
    z.union([z.string(), z.object({ _id: z.string() }).passthrough()])
  ),
  hyresobjekt: z.array(
    z.union([z.string(), z.object({ _id: z.string() }).passthrough()])
  ),
})

export const TenfastBatchGetRentalObjectSchema = z
  .object({
    _id: z.string(),
    externalId: z.string(), // rental object code, e.g. "306-008-01-0201"
    avtal: z.array(TenfastBatchGetLeaseSchema),
  })
  .passthrough()

export const TenfastBatchGetRentalObjectsResponseSchema = z.array(
  TenfastBatchGetRentalObjectSchema
)

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
export type TenfastRentArticle = z.infer<typeof TenfastRentArticleSchema>
export type TenfastBatchGetLease = z.infer<typeof TenfastBatchGetLeaseSchema>
export type TenfastBatchGetRentalObject = z.infer<
  typeof TenfastBatchGetRentalObjectSchema
>
export type TenfastBatchGetRentalObjectsResponse = z.infer<
  typeof TenfastBatchGetRentalObjectsResponseSchema
>

export type TenfastRentalProperty = z.infer<typeof TenfastRentalPropertySchema>
