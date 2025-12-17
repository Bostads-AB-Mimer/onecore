import { Factory } from 'fishery'

import {
  TenfastInvoiceRow,
  TenfastLease,
  TenfastRentalObject,
  TenfastRentalObjectByRentalObjectCodeResponse,
  TenfastTenant,
} from '../../adapters/tenfast/schemas'

export const TenfastLeaseFactory = Factory.define<TenfastLease>(
  ({ sequence }) => ({
    externalId: `externalId-${sequence}`,
    reference: sequence,
    version: 1,
    originalData: {},
    hyror: [],
    simpleHyra: false,
    startDate: new Date(),
    endDate: null,
    aviseringsTyp: 'email',
    uppsagningstid: '3 månader',
    aviseringsFrekvens: 'månad',
    forskottAvisering: 'nej',
    betalningsOffset: '0',
    betalasForskott: false,
    vatEnabled: false,
    method: 'digital',
    file: {
      key: `file-key-${sequence}`,
      location: 'https://files.example.com/file.pdf',
      originalName: 'file.pdf',
    },
    bankidSigningEnabled: false,
    bankidSignatures: [],
    cancellation: {
      cancelled: false,
      doneAutomatically: false,
      receivedCancellationAt: null,
      notifiedAt: null,
      handledAt: null,
      handledBy: null,
      preferredMoveOutDate: null,
    },
    deposit: {
      ekoNotifications: [],
    },
    id: `lease-${sequence}`,
    _id: `lease-mongo-${sequence}`,
    hyresvard: 'hyresvard-1',
    hyresgaster: [],
    hyresobjekt: [TenfastRentalObjectFactory.build()],
    invitations: [],
    confirmedHyresgastInfo: [],
    acceptedByHyresgast: false,
    comments: [],
    files: [],
    versions: {},
    updatedBy: `user-${sequence}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    startInvoicingFrom: new Date(),
    signedAt: new Date(),
    tags: [],
  })
)

export const TenfastTenantFactory = Factory.define<TenfastTenant>(
  ({ sequence }) => ({
    _id: `tenant-${sequence}`,
    name: { first: `first-${sequence}`, last: `last-${sequence}` },
    moms: 123,
    alternatePhones: [],
    comments: [],
    onlineInboxes: {},
    signeringsMetod: 'digital',
    hyresvard: 'hyresvard-1',
    isCompany: false,
    phone: '1234567890',
    idbeteckning: 'idbeteckning-1',
    postadress: 'postadress-1',
    postnummer: 'postnummer-1',
    stad: 'stad-1',
    externalId: 'externalId-1',
    borgenarer: [],
    firmatecknare: [],
    displayName: 'displayName-1',
  })
)

export const TenfastRentalObjectFactory = Factory.define<TenfastRentalObject>(
  ({ sequence }) => ({
    _id: `rental-object-${sequence}`,
    hyra: 287.17,
    hyraVat: 0,
    hyraExcludingVat: 287.17,
    hyror: [TenfastInvoiceRowFactory.build()],
    externalId: 'externalId-1',
  })
)

export const TenfastRentalObjectByRentalObjectCodeResponseFactory =
  Factory.define<TenfastRentalObjectByRentalObjectCodeResponse>(
    ({ sequence }) => ({
      records: [
        {
          _id: '67eb8af5545c8f1195bef2e6' + sequence,
          hyra: 287.17,
          hyraVat: 0, // total moms pa hyran
          hyraExcludingVat: 287.17, // hyran exklusive moms
          hyror: TenfastInvoiceRowFactory.buildList(3),
          externalId: `externalId-${sequence}`,
        },
      ],
      prev: null,
      next: null,
      totalCount: 1,
    })
  )

export const TenfastInvoiceRowFactory = Factory.define<TenfastInvoiceRow>(
  ({ sequence }) => ({
    amount: 115,
    vat: 0.25,
    from: '2013-03',
    article: '12334567' + sequence,
    label: 'Hyra p-plats',
    _id: sequence.toString(),
  })
)
