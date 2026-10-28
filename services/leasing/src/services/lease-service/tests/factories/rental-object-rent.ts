import { Factory } from 'fishery'
import { RentalObjectRent } from '@onecore/types'

export const RentalObjectRentFactory = Factory.define<RentalObjectRent>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    amount: 1200,
    vat: 0,
    rows: [
      {
        code: 'RENT',
        description: 'Monthly Rent',
        amount: 1200,
        vatPercentage: 0,
      },
    ],
  })
)
