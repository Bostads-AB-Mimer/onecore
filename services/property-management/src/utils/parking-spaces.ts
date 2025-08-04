import {
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
  ParkingSpaceType,
  parkingSpaceTypeTranslation,
} from 'onecore-types'

const getStreet = (streetAndNumber: string) => {
  const matches = streetAndNumber.split(/([^0-9]+) ([0-9].*)/)

  return matches[1]
}

const getStreetNumber = (streetAndNumber: string) => {
  const matches = streetAndNumber.split(/([^0-9]+) ([0-9].*)/)

  return matches.length > 1 ? matches[2] : ''
}
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

export { getStreet, getStreetNumber, getParkingSpaceType, getParkingSpaceApplicationCategory }