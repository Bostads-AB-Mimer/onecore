import axios from 'axios'
import Config from '../../../common/config'
// Temporary adapter to be replaced when propertyInfo is fetched from xpand

// Temporary interface to be replaced by the one from onecore-types when propertyInfo is fetched from xpand
interface RentalPropertyInfo {
  id: string
  address: string
  type: string
  size: string
  estateCode: string
  estateName: string
  blockCode: string
}

const getRentalPropertyInfo = async (
  propertyId: string
): Promise<RentalPropertyInfo | undefined> => {
  try {
    const url = Config.appsMimerNu.url
    const constraints = [
      {
        key: 'rentalPropertyId',
        constraint_type: 'equals',
        value: propertyId,
      },
    ]

    const response = await axios.get(url, {
      params: {
        constraints: JSON.stringify(constraints),
      },
    })

    const responseData = response.data.response?.results || []

    if (responseData.length > 0) {
      return {
        id: propertyId,
        address: responseData[0].adress,
        type: responseData[0].type,
        size: responseData[0].bra,
        estateCode: responseData[0].estateCode,
        estateName: responseData[0].estateCaption,
        blockCode: responseData[0].blockCode,
      }
    }
  } catch (error) {
    console.error('Error getting rental property info', error)
    return undefined
  }
}

export { getRentalPropertyInfo }
