import { Factory } from 'fishery'

import {
  TenfastTenant,
  TenfastInvoice,
  TenfastInvoiceRow,
  TenfastLease,
  TenfastRentArticle,
  TenfastTenantByContactCodeResponse,
  TenfastInvoicesByTenantIdResponse,
  type TenfastAutogiroConsent,
  type TenfastOutboundExport,
} from '@src/common/adapters/tenfast/schemas'

export const TenfastTenantFactory = Factory.define<TenfastTenant>(
  ({ sequence }) => ({
    _id: 'sequence',
    externalId: `P${sequence}`,
    name: {
      first: 'Test',
      last: 'Persson',
    },
    phone: '123456789',
    alternatePhones: [],
    comments: [],
    onlineInboxes: {},
    signeringsMetod: 'BankID',
    hyresvard: 'hyresvard-123',
    isCompany: false,
    idbeteckning: `P${sequence}`,
    postadress: 'Test Street 123',
    postnummer: '12345',
    stad: 'Test City',
    borgenarer: [],
    firmatecknare: [],
    displayName: 'Test Persson',
    moms: 25,
  })
)

export const TenfastInvoiceRowFactory = Factory.define<TenfastInvoiceRow>(
  ({ sequence }) => ({
    _id: `row-${sequence}`,
    amount: 1000,
    article: 'HYRAB',
    from: '2024-01-01',
    to: '2024-01-31',
    vat: 0,
    consolidationLabel: 'Hyra bostad',
    label: 'Hyra bostad',
    hyresobjekt: 'property-123',
    accountingRows: [],
  })
)

export const TenfastInvoiceFactory = Factory.define<TenfastInvoice>(
  ({ sequence }) => ({
    _id: `invoice-${sequence}`,
    id: `invoice-${sequence}`,
    ocrNumber: '55123456',
    amount: 1000,
    amountPaid: 0,
    interval: {
      from: '2024-01-01',
      to: '2024-01-31',
    },
    activatedAt: '2024-01-15T10:00:00Z',
    expectedInvoiceDate: '2024-01-15T10:00:00Z',
    due: '2024-02-15T10:00:00Z',
    hyresvard: 'hyresvard-123',
    avtal: [
      {
        _id: 'lease-123',
        id: 'lease-123',
        externalId: `306-008-01-0${sequence.toString().padStart(3, '0')}/01`,
        hyresobjekt: [
          {
            _id: `obj-${sequence}`,
            nummer: '123',
            skvNummer: null,
            postadress: 'Test Street 123',
            externalId: 'prop-123',
            displayName: 'Test Property',
            subType: 'apartment',
            states: [],
          },
        ],
        hyresgaster: [
          {
            name: { first: 'Test', last: 'Persson' },
            _id: `tenant-${sequence}`,
            externalId: `P${sequence}`,
            company: '',
            isCompany: false,
            displayName: 'Test Persson',
          },
        ],
        reference: 123456,
        stage: 'active',
        canDelete: false,
        canVoid: false,
      },
    ],
    vatEnabled: false,
    propertyTax: false,
    simpleHyra: true,
    acceptDiff: false,
    aviseringsTyp: 'email',
    sentAutomatically: true,
    partiell: false,
    emails: [],
    ekoNotifications: [],
    skipEmail: false,
    markedAsLate: false,
    reference: 55123456,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    __v: 0,
    late: false,
    state: 'ny',
    hyror: [],
  })
)

export const TenfastLeaseFactory = Factory.define<TenfastLease>(
  ({ sequence }) => ({
    _id: `lease-${sequence}`,
    id: `lease-${sequence}`,
    externalId: `306-008-01-0${sequence.toString().padStart(3, '0')}/01`,
    startDate: new Date('2020-01-01'),
    endDate: null,
    stage: 'active',
    hyresgaster: [
      {
        _id: `tenant-${sequence}`,
        name: {
          first: 'Test',
          last: 'Persson',
        },
        isCompany: false,
        displayName: 'Test Persson',
      },
    ],
    hyresobjekt: [
      {
        nummer: '123',
        postadress: 'Test Street 123',
        skvNummer: null,
        displayName: 'Test Property',
        states: [],
        externalId: `306-008-01-0${sequence.toString().padStart(3, '0')}`,
        hyresvard: 'hyresvard-123',
        hyra: 5000,
        hyraExcludingVat: 5000,
        hyraVat: 0,
        hyror: [],
        postnummer: '12345',
        stad: 'Test City',
        stadsdel: 'Test District',
        typ: 'apartment',
        kvm: 50,
        roomCount: 2,
        bostadType: 'apartment',
        parkeringType: null,
        lokalType: null,
        category: null,
        images: [],
        files: [],
        comments: [],
        tags: [],
        useCounter: 0,
        avtalStates: [],
        lastStateChanged: '2024-01-01T10:00:00Z',
        updatedAt: new Date('2024-01-01'),
      },
    ],
    reference: 123456,
    invitationsToRegister: [],
    canDelete: false,
    depositState: [],
  })
)

export const TenfastRentArticleFactory = Factory.define<TenfastRentArticle>(
  ({ sequence }) => ({
    _id: `${sequence}`,
    label: 'Hyra bostad',
    type: 'rent',
    accountNr: '3012',
    createdAt: '2024-01-01T10:00:00Z',
    hyresvard: 'test-hyresvard',
    code: 'HYRAB',
    title: 'Hyra bostad',
    includeInContract: true,
  })
)

export const TenfastTenantByContactCodeResponseFactory =
  Factory.define<TenfastTenantByContactCodeResponse>(() => ({
    records: [TenfastTenantFactory.build()],
  }))

export const TenfastInvoicesByTenantIdResponseFactory =
  Factory.define<TenfastInvoicesByTenantIdResponse>(() => [
    TenfastInvoiceFactory.build({
      hyror: [TenfastInvoiceRowFactory.build()],
    }),
  ])

export const TenfastAutogiroConsentFactory =
  Factory.define<TenfastAutogiroConsent>(({ sequence }) => ({
    _id: `consent-${sequence}`,
    hyresgast: `tenant-${sequence}`,
    hyresvard: 'hyresvard-123',
    hyresvardBankgiro: '123-4567',
    payerNumber: sequence,
    fixedDueDay: null,
    isCompany: false,
    payerSSN: '199001011234',
    status: 'ACTIVE',
    statusChangedAt: new Date('2024-01-01T00:00:00Z'),
    extra: {
      nameAndAddress1: 'Test Persson',
      mismatch: null,
    },
    payerBankAccountNumber: '12345678',
  }))
export const TenfastInvoiceByOcrResponseFactory =
  Factory.define<TenfastInvoice>(() =>
    TenfastInvoiceFactory.build({
      amountPaid: 500,
      hyror: [TenfastInvoiceRowFactory.build()],
    })
  )

export const TenfastOutboundExportFactory =
  Factory.define<TenfastOutboundExport>(({ sequence }) => ({
    _id: `export-id-${sequence}`,
    provider: 'stralfors',
    type: 'stralfors_invoice',
    format: 'xml',
    status: 'NEW',
    size: 1024,
    filename: `job-${sequence}.xml`,
    invoicesCount: 2,
    sentAt: null,
    failedAt: null,
    createdAt: '2026-06-09T13:41:20.378Z',
    updatedAt: '2026-06-09T13:41:20.378Z',
  }))
