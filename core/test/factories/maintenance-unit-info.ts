import { Factory } from 'fishery'
import { MaintenanceUnitInfo } from 'onecore-types'

export const MaintenanceUnitInfoFactory = Factory.define<MaintenanceUnitInfo>(
  ({ sequence }) => ({
    id: `ABC${sequence}`,
    rentalPropertyId: '123-456-789',
    code: '111111',
    caption: 'TVÄTTSTUGA Testgatan 1',
    type: 'Tvättstuga',
    estateCode: '01234',
    estate: 'TESTET 1',
  })
)
