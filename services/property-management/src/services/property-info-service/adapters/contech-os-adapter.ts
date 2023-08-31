import axios from 'axios'
import { RentalProperty, RoomType } from '../../../common/types'
import Config from '../../../common/config'

const getApartmentInfo = async () => {
  const url = `${Config.contechOs.url}`

  const response = await axios({
    method: 'post',
    url: url,
    headers: {
      'Ocp-Apim-Subscription-Key': 'ac9c3fa0c9d04aca866e65b780002804',
    },
    data: {
      "targetTitle":"406-091-08-0101"
    }
  })

  return response
}

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

const getRoomTypes = async (aparmentId: string): Promise<Array<RoomType>> => {
  /*Get real data*/
  return [
    { roomTypeId: '1', name: 'Kök & Hall' },
    { roomTypeId: '2', name: 'Badrum' },
    { roomTypeId: '3', name: 'Vardagsrum' },
    { roomTypeId: '4', name: 'Sovrum 1' },
  ]
}

const getRoomType = async (
  aparmentId: string,
  roomTypeId: string
): Promise<RoomType | undefined> => {
  /*Get real data*/
  const roomTypes = await getRoomTypes(aparmentId)

  return roomTypes.find(
    (roomType: RoomType) => roomType.roomTypeId == roomTypeId
  )
}

export { getRoomTypes, getRoomType, getRentalProperty, getApartmentInfo }
