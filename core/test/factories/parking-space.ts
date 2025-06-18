import { Factory } from 'fishery'
import { VacantParkingSpace } from 'onecore-types'

export const ParkingSpaceFactory = Factory.define<VacantParkingSpace>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Karl IX:s V 18',
    monthlyRent: 1000,
    districtCaption: 'Distrikt Norr',
    districtCode: '2',
    blockCaption: 'LINDAREN 2',
    blockCode: '1401',
    objectTypeCaption: 'Motorcykelgarage',
    objectTypeCode: 'MCGAR',
    rentalObjectTypeCaption: 'Standard hyresobjektstyp',
    rentalObjectTypeCode: 'STD',
    vehicleSpaceCode: '0008',
    vehicleSpaceCaption: 'KARL IX:S VÄG 18',
    restidentalAreaCaption: 'Centrum',
    restidentalAreaCode: 'CTR',
    vacantFrom: new Date('2023-10-01'),
  })
)
