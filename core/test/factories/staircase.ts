import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const StaircaseFactory = Factory.define<
  components['schemas']['Staircase']
>(({ sequence }) => ({
  id: `_0J415BS4${sequence}`,
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
  property: {
    propertyId: `_0J415BS4${sequence}`,
    propertyName: 'Fastigheten',
    propertyCode: `010${sequence}`,
  },
  building: {
    buildingId: `_0J415BS4${sequence}`,
    buildingName: 'Byggnaden',
    buildingCode: `010${sequence}`,
  },
  timestamp: '2024-10-01T00:00:00Z',
}))
