import { Factory } from 'fishery'
import { RentalObject } from 'onecore-types'

export const RentalObjectFactory = Factory.define<RentalObject>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Flugsnappargatan',
    districtCaption: 'Distrikt Väst',
    districtCode: '4',
    objectTypeCaption: 'Parkeringsplats utan el',
    objectTypeCode: 'PPLUEL',
    vacantFrom: new Date(),
    monthlyRent: 1000,
    restidentalAreaCode: '61145',
    restidentalAreaCaption: 'Råby',
  })
)
