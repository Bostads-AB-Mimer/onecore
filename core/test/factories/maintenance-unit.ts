import { Factory } from 'fishery'
import { components } from '../../src/adapters/property-base-adapter/generated/api-types'

export const MaintenanceUnitFactory = Factory.define<
  components['schemas']['MaintenanceUnit']
>(({ sequence }) => ({
  id: `ABC${sequence}`,
  rentalPropertyId: '123-456-789',
  code: '111111',
  caption: 'TVÄTTSTUGA Testgatan 1',
  type: 'Tvättstuga',
  property: {
    id: 'PROPERTY_ID',
    code: 'PROPERTY_CODE',
    name: 'PROPERTY_NAME',
  },
  building: {
    id: 'BUILDING_ID',
    code: 'BUILDING_CODE',
    name: 'BUILDING_NAME',
  },
}))
