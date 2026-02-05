import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const RoomFactory = Factory.define<components['schemas']['Room']>(
  ({ sequence }) => ({
    id: `_0J415BS4${sequence}`,
    propertyObjectId: `_0J415COBJ${sequence}`,
    code: `010${sequence}`,
    name: 'Adressgatan 123',
    deleted: false,
    timestamp: '2024-10-01T00:00:00Z',
    dates: {
      installation: '2024-10-01T00:00:00Z',
      from: '2024-10-01T00:00:00Z',
      to: '2025-10-01T00:00:00Z',
      availableFrom: '2024-10-01T00:00:00Z',
      availableTo: '2025-10-01T00:00:00Z',
    },
    features: {
      hasThermostatValve: true,
      hasToilet: true,
      isHeated: true,
      orientation: 1,
    },
    usage: {
      shared: true,
      allowPeriodicWorks: true,
      spaceType: 1,
    },
    sortingOrder: 1,
    roomType: {
      id: '1',
      code: '1',
      name: '1',
      use: 1,
      optionAllowed: 1,
      isSystemStandard: 1,
      allowSmallRoomsInValuation: 1,
      timestamp: '2024-10-01T00:00:00Z',
    },
  })
)
