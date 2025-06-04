import { Factory } from 'fishery'
import { VacantParkingSpace } from 'onecore-types'

export const VacantParkingSpaceFactory = Factory.define<VacantParkingSpace>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Sample Address',
    monthlyRent: 1000,
    districtCaption: 'Malmaberg',
    districtCode: 'MAL',
    blockCaption: 'LINDAREN 2',
    blockCode: '1401',
    restidentalAreaCaption: 'res_area',
    restidentalAreaCode: 'RES_AREA',
    objectTypeCaption: 'Carport',
    objectTypeCode: 'CPORT',
    vacantFrom: new Date(),
    vehicleSpaceCaption: 'Space 1',
    vehicleSpaceCode: 'SPACE_1',
  })
)
