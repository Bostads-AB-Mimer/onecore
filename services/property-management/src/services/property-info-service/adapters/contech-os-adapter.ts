import axios from 'axios'
import { RentalProperty, RoomType } from '../../../common/types'

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
    { roomTypeId: 'KOKHALL', name: 'Kök & Hall' },
    { roomTypeId: 'BADRUM', name: 'Badrum' },
    { roomTypeId: 'VARDAGSRUM', name: 'Vardagsrum' },
    { roomTypeId: 'SOVRUM1', name: 'Sovrum 1' },
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

export { getRoomTypes, getRoomType, getRentalProperty }
