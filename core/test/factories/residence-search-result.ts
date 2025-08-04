import { Factory } from 'fishery'

import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const ResidenceSearchResultFactory = Factory.define<
  components['schemas']['ResidenceSearchResult']
>(({ sequence }) => ({
  code: `010${sequence}`,
  deleted: false,
  id: `residence-${sequence}`,
  name: `Residence ${sequence}`,
  building: { code: null, name: null },
  property: { code: null, name: null },
  rentalId: `rental-${sequence}`,
  validityPeriod: {
    fromDate: '2024-10-01T00:00:00Z',
    toDate: '2025-10-01T00:00:00Z',
  },
}))
