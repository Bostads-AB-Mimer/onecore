import axios from 'axios'
import Config from '../../../common/config'
import {
  parkingSpaceApplicationCategoryTranslation,
  parkingSpaceTypeTranslation,
  ParkingSpace,
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
} from 'onecore-types'

const getParkingSpaceType = (typeCode: string) => {
  let type = parkingSpaceTypeTranslation[typeCode]

  if (!type) {
    type = ParkingSpaceType.ParkingSpaceWithoutElectricity
  }

  return type
}

const getParkingSpaceApplicationCategory = (waitingListType: string) => {
  let category = parkingSpaceApplicationCategoryTranslation[waitingListType]

  if (!category) {
    category = ParkingSpaceApplicationCategory.internal
  }

  return category
}

const getStreet = (streetAndNumber: string) => {
  const matches = streetAndNumber.split(/([^0-9]+) ([0-9].*)/)

  return matches[1]
}

const getStreetNumber = (streetAndNumber: string) => {
  const matches = streetAndNumber.split(/([^0-9]+) ([0-9].*)/)

  return matches.length > 1 ? matches[2] : ''
}

const getParkingSpace = async (parkingSpaceId: string) => {
  try {
    const url = `${Config.xpandService.url}/publishedrentalobjects/parkings/${parkingSpaceId}`

    const response = await axios({
      method: 'get',
      url: url,
    })

    const parkingSpace: ParkingSpace = {
      parkingSpaceId: response.data.rentalObjectCode,
      address: {
        street: getStreet(response.data.postalAddress),
        number: getStreetNumber(response.data.postalAddress),
        postalCode: response.data.zipCode,
        city: response.data.city,
      },
      vacantFrom: response.data.vacantFrom,
      rent: {
        currentRent: {
          leaseId: undefined,
          rentId: undefined,
          currentRent: response.data.monthRent,
          vat: response.data.vatIncluded ?? 0,
          additionalChargeAmount: undefined,
          additionalChargeDescription: undefined,
          rentStartDate: undefined,
          rentEndDate: undefined,
        },
        futureRents: [],
      },
      type: getParkingSpaceType(response.data.objectTypeCode),
      applicationCategory: getParkingSpaceApplicationCategory(
        response.data.waitingListType
      ),
    }

    return parkingSpace
  } catch (error) {
    console.error('Error getting parking space', error)
    return null
  }
}

export { getParkingSpace }
