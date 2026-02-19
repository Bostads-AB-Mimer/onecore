import { Factory } from 'fishery'
import { TenfastTenant } from '../../adapters/tenfast/schemas'

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
