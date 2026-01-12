import { Factory } from 'fishery'

import { FacilityDetails } from '../../src/services/property-base-service/schemas'

export const FacilityDetailsFactory = Factory.define<FacilityDetails>(
  ({ sequence }) => ({
    id: `WO${sequence}`,
    propertyObjectId: `PO${sequence}`,
    code: `WO${sequence}`,
    name: 'Name',
    entrance: 'Entrance',
    deleted: false,
    type: {
      code: 'TypeCode',
      name: 'TypeName',
    },
    rentalInformation: {
      apartmentNumber: 'ApartmentNumber',
      rentalId: 'RentalId',
      type: {
        code: 'TypeCode',
        name: 'TypeName',
      },
    },
    property: {
      id: 'PropertyId',
      code: 'PropertyCode',
      name: 'PropertyName',
    },
    building: {
      id: 'BuildingId',
      code: 'BuildingCode',
      name: 'BuildingName',
    },
    areaSize: 100,
  })
)
