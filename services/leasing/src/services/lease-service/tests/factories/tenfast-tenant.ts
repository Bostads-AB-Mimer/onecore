import { Factory } from 'fishery'
import { TenfastTenant } from '../../../../common/adapters/tenfast/schemas'

export const TenfastTenantFactory = Factory.define<TenfastTenant>(
  ({ sequence }) => ({
    name: { first: 'Oliver', last: 'Rickman' },
    _id: '691c8960a887aa7a3f9f19eb' + sequence,
    hyresvard: '6344b398b63ff59d5bde8257',
    isCompany: false,
    idbeteckning: '199401268652',
    moms: 0,
    phone: '0762827070',
    alternatePhones: [],
    postadress: 'Styrbordsgatan 5 ',
    postnummer: '72359',
    stad: 'VÄSTERÅS',
    comments: [],
    onlineInboxes: {},
    externalId: 'P173432',
    signeringsMetod: 'BankID',
    borgenarer: [],
    firmatecknare: [],
    displayName: 'Oliver Rickman',
  })
)
