import { Factory } from 'fishery'

import {
  TenfastTenant,
  TenfastInvoice,
  TenfastInvoiceRow,
  TenfastLease,
  TenfastRentArticle,
  TenfastTenantByContactCodeResponse,
  TenfastInvoicesByTenantIdResponse,
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
    avtal: ['lease-123'],
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
        _id: `property-${sequence}`,
        nummer: '123',
        postadress: 'Test Street 123',
        skvNummer: null,
        displayName: 'Test Property',
        subType: 'apartment',
        states: [],
      },
    ],
    reference: 123456,
    stage: 'active',
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

export const TenfastInvoicesByOcrResponseFactory = Factory.define<any>(() => ({
  records: [
    {
      ...TenfastInvoiceFactory.build({
        amountPaid: 500,
        hyror: [TenfastInvoiceRowFactory.build()],
      }),
      avtal: [TenfastLeaseFactory.build()],
    },
  ],
}))
