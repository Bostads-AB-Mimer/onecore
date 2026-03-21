import { Factory } from 'fishery'
import { RentalObjectAvailabilityInfo } from '@onecore/types'
import { RentalObjectRentFactory } from './rental-object-rent'

export const RentalObjectAvailabilityInfoFactory =
  Factory.define<RentalObjectAvailabilityInfo>(({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    rent: RentalObjectRentFactory.build(),
    vacantFrom: new Date(),
  }))
