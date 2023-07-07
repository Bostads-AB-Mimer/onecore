import { RentalProperty } from '../../../common/types'

const getRentalProperty = async (
  rentalPropertyId: string
): Promise<RentalProperty> => {
  const applianceNames = ['Tvättmaskin', 'Skotork']

  return {
    rentalPropertyId,
    apartmentNumber: Math.round(Math.random() * 1000),
    size: Math.round(Math.random() * 200),
    address: {
      street: 'Björnvägen',
      number: Math.round(Math.random() * 100).toString(),
      postalCode: '74212',
      city: 'Västerås',
    },
    rentalPropertyType: Math.round((Math.random() + 0.1) * 6) + ' rum och kök',
    type: Math.round((Math.random() + 0.1) * 6) + ' rum och kök',
    additionsIncludedInRent: applianceNames.join(', '),
    otherInfo: undefined,
    lastUpdated: undefined,
  }
}

export { getRentalProperty }
