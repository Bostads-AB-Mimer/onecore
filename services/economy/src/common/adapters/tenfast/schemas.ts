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
        externalId: z.string()
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
  'makulerad',
  'draft',
  'pamind',
  'gracePeriod',
])

export type TenfastInvoiceState = z.infer<typeof TenfastInvoiceStateSchema>

/** Tenfast invoice states parsed but not exposed as Invoice. */
export const EXCLUDED_TENFAST_INVOICE_STATES: readonly TenfastInvoiceState[] = [
  'draft',
]

export function isVisibleTenfastInvoice(invoice: {
  state: TenfastInvoiceState
}): boolean {
  return !EXCLUDED_TENFAST_INVOICE_STATES.includes(invoice.state)
}

export const TenfastGracePeriodSchema = z.object({
  endDate: z.string(),
  reason: z.string(),
  madeBy: z.string(),
  madeByEmail: z.string(),
})

export const TenfastInvoiceSchema = z.object({
  interval: z.object({
    from: z.string(),
    to: z.string(),
  }),
  _id: z.string(),
  hyresvard: z.string(),
  avtal: z.array(TenfastLeaseSchema),
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
  roundingAmount: z.number().optional(),
  reference: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  ocrNumber: z.string(),
  late: z.boolean(),
  state: TenfastInvoiceStateSchema,
  gracePeriod: TenfastGracePeriodSchema.nullish(),
  recipientContactCode: z.string().optional(),
  recipientName: z.string().optional(),
  contractCode: z.string().optional(),
})

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

export const TenfastAccountConfigurationSchema = z.object({
  accountNr: z.number(),
  categoryCode: z.string(),
  debitType: z.string(),
  costCenter: z.string(),
  property: z.string(),
  freeText: z.string(),
  projectCode: z.string(),
})

export type TenfastAccountConfiguration = z.infer<
  typeof TenfastAccountConfigurationSchema
>
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
  accountConfigurations: z.array(TenfastAccountConfigurationSchema).optional(),
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

// No schema for this in Tenfast docs currently, this is guesswork based on response
export const TenfastAutogiroConsentSchema = z.object({
  _id: z.string(),
  hyresgast: z.string(),
  hyresvard: z.string(),
  hyresvardBankgiro: z.string(),
  payerNumber: z.number(),
  fixedDueDay: z.coerce.date().nullable(), // TODO is this a date string?
  isCompany: z.boolean(),
  payerSSN: z.string(),
  status: z.enum(['ACTIVE', 'MANUAL']), // TODO are there more possible statuses?
  statusChangedAt: z.coerce.date(),
  extra: z.object({
    nameAndAddress1: z.string(),
    mismatch: z.string().nullable(), // TODO is this a string?
  }),
  payerBankAccountNumber: z.string(),
})

export const TenfastAutogiroConsentResponseSchema = z.object({
  records: z.array(TenfastAutogiroConsentSchema),
  prev: z.string().nullable(),
  next: z.string().nullable(),
  totalCount: z.number(),
})

export type TenfastInvoiceRow = z.infer<typeof TenfastInvoiceRowSchema>
export type TenfastInvoice = z.infer<typeof TenfastInvoiceSchema>
export type TenfastInvoicesByTenantIdResponse = z.infer<
  typeof TenfastInvoicesByTenantIdResponseSchema
>
export type TenfastTenant = z.infer<typeof TenfastTenantSchema>
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

export type TenfastAutogiroConsent = z.infer<
  typeof TenfastAutogiroConsentSchema
>

export const TenfastOutboundExportSchema = z.object({
  _id: z.string(),
  provider: z.string(),
  type: z.string(),
  format: z.string(),
  status: z.enum(['NEW', 'SENT', 'FAILED']),
  size: z.number(),
  filename: z.string(),
  invoicesCount: z.number(),
  sentAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const TenfastOutboundExportListSchema = z.object({
  records: z.array(TenfastOutboundExportSchema),
  prev: z.string().nullable(),
  next: z.string().nullable(),
  totalCount: z.number(),
})

export type TenfastOutboundExport = z.infer<typeof TenfastOutboundExportSchema>

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

// Looking up invoices by the export endpoint (/v1/hyresvard/hyror) returns
// populated `avtal` objects, but those lease objects are far leaner than the
// full `TenfastLeaseSchema` (hyresobjekt come back as IDs, many optional
// fields are missing, etc.). Downstream only needs `_id`, `externalId`, and
// the first tenant's `externalId` / `displayName`, so we use a permissive lean
// schema here rather than the strict lease schema. Additional fields returned
// by Tenfast are passed through untouched.
const TenfastExportLeaseSchema = z
  .object({
    _id: z.string(),
    externalId: z.string(),
    hyresgaster: z
      .array(
        z.object({
          _id: z.string(),
          externalId: z.string(),
          displayName: z.string(),
        })
      )
      .min(1),
    canVoid: z.boolean().optional(),
  })
  .passthrough()

export const TenfastInvoicesByExportedResponseSchema = z.object({
  records: z.array(
    TenfastInvoiceSchema.extend({
      avtal: z.array(TenfastExportLeaseSchema),
      ocrNumber: z.string().optional(),
      reference: z.coerce.string().optional(),
    }).transform((data) => ({
      ...data,
      reference: data.reference ?? '',
      ocrNumber: data.ocrNumber ?? '',
      contractCode: data.avtal[0]?.externalId,
      recipientContactCode: data.avtal[0]?.hyresgaster[0]?.externalId,
      recipientName: data.avtal[0]?.hyresgaster[0]?.displayName,
    }))
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
      recipientContactCode: data.avtal[0]?.hyresgaster[0]?.externalId, // TODO: Add
      recipientName:
        data.snapshot?.hyresgaster[0]?.displayName ??
        data.avtal[0]?.hyresgaster[0]?.displayName,
    }))
  ),
})

export const TenfastInvoicesByTenantIdResponseSchema =
  z.array(TenfastInvoiceSchema)

export const TenfastTenantByContactCodeResponseSchema = TenfastTenantSchema

export type TenfastInvoicesByExportedResponse = z.infer<
  typeof TenfastInvoicesByExportedResponseSchema
>
export type TenfastInvoicesByOcrResponse = z.infer<
  typeof TenfastInvoicesByOcrResponseSchema
>
export type TenfastTenantByContactCodeResponse = z.infer<
  typeof TenfastTenantByContactCodeResponseSchema
>

// Rental loss (hyresbortfall) for a single rental object for a single month.
// Mirrors the shape of stuff/tenfast/hyresbortfall.json.
export const TenfastRentalLossHyraSchema = z.object({
  _id: z.string(),
  label: z.string(),
  amount: z.number(),
  vat: z.number(),
  hyresobjekt: z.string(),
  article: z.string().nullable(),
  includeInContract: z.boolean(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  consolidationLabel: z.string().nullable().optional(),
})

export const TenfastRentalLossSchema = z.object({
  month: z.string(), // "YYYY-MM"
  hyresvard: z.object({
    id: z.string(),
    name: z.string(),
  }),
  hyresobjekt: z.object({
    id: z.string(),
    externalId: z.string(),
    fastighetId: z.string(),
    postadress: z.string(),
    postnummer: z.string(),
    stad: z.string(),
    skvNummer: z.union([z.string(), z.number()]).nullable(),
    objektnummer: z.string(),
    typ: z.string(),
    hyror: z.array(TenfastRentalLossHyraSchema),
  }),
  days: z.object({
    month: z.number(),
    contracted: z.number(),
    uncontracted: z.number(),
  }),
  uncontractedIntervals: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ),
  avtalIds: z.array(z.string()),
  relatedAvtalCoverage: z.array(
    z.object({
      avtalId: z.string(),
      source: z.string(),
      reference: z.number(),
      externalId: z.string(),
      version: z.number(),
      hyresobjekt: z.array(z.string()),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      signed: z.boolean(),
      signedAt: z.string().nullable(),
      cancellation: z
        .object({
          cancelled: z.boolean(),
          doneAutomatically: z.boolean().optional(),
        })
        .optional(),
      automaticExtension: z.any().nullable(),
    })
  ),
})

export const TenfastRentalLossResponseSchema = z.array(TenfastRentalLossSchema)

export type TenfastRentalLossHyra = z.infer<typeof TenfastRentalLossHyraSchema>
export type TenfastRentalLoss = z.infer<typeof TenfastRentalLossSchema>
