import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const ResidenceFactory = Factory.define<
  components['schemas']['Residence']
>(({ sequence }) => ({
  id: `_0J415BS4${sequence}`,
  code: `010${sequence}`,
  name: 'Adressgatan 123',
  deleted: false,
  validityPeriod: {
    fromDate: '2024-10-01T00:00:00Z',
    toDate: '2025-10-01T00:00:00Z',
  },
}))
