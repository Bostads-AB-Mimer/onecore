import { Factory } from 'fishery'

import {
  TenfastLease,
  TenfastRentalObject,
  TenfastTenant,
} from '../../../../common/adapters/tenfast/schemas'

export const TenfastLeaseFactory = Factory.define<TenfastLease>(
  ({ sequence }) => ({
    reference: sequence,
    verson: 1,
    originalData: {},
    hyror: [],
    simpleHyra: false,
    startDate: new Date(2022, 0, 1),
    endDate: null,
    aviseringsTyp: 'email',
    uppsagningstid: '3 månader',
    aviseringsFrekvens: 'månad',
    forskottsAvisering: 'nej',
    betalningsOffset: '0',
    betalasForskott: false,
    vatEnabled: false,
    originalTemplate: 'template-1',
    template: {},
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
      hyresgastBankidSignature: '',
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
    avtalsbyggare: false,
    acceptedByHyresgast: false,
    comments: [],
    files: [],
    versions: {},
    incudeHyrorInThePast: false,
    createdBy: `user-${sequence}`,
    updatedBy: `user-${sequence}`,
    createdAt: new Date(2022, 0, 1),
    updatedAt: new Date(2022, 0, 2),
    tags: [],
    wasNew: false,
    wasAccepted: false,
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
    hyror: [],
    externalId: 'externalId-1',
  })
)
