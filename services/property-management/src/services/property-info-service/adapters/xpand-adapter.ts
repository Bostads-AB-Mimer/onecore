import axios from 'axios'
import Config from '../../../common/config'
import { ParkingSpace } from 'onecore-types'
import {
  getParkingSpaceApplicationCategory,
  getParkingSpaceType,
  getStreet,
  getStreetNumber,
} from '../../../utils/parking-spaces'


const getParkingSpace = async (
  parkingSpaceId: string,
): Promise<ParkingSpace | undefined> => {
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
        response.data.waitingListType,
      ),
    }

    return parkingSpace
  } catch (error) {
    console.error('Error getting parking space', error)
    return undefined
  }
}

export { getParkingSpace }
