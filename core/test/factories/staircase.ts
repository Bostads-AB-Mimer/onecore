import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const StaircaseFactory = Factory.define<
  components['schemas']['Staircase']
>(({ sequence }) => ({
  id: `_0J415BS4${sequence}`,
  buildingCode: `1234567${sequence}`,
  code: `010${sequence}`,
  name: 'Adressgatan 123',
  deleted: false,
  dates: {
    from: '2024-10-01T00:00:00Z',
    to: '2025-10-01T00:00:00Z',
  },
  features: {
    floorPlan: '1',
    accessibleByElevator: true,
  },
  timestamp: '2024-10-01T00:00:00Z',
}))
