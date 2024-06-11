import { loggedAxios as axios } from 'onecore-utilities'
import {
  Listing,
  MaintenanceUnitInfo,
  MaterialChoice,
  MaterialOption,
  ParkingSpace,
  RentalProperty,
  RentalPropertyInfo,
} from 'onecore-types'
import config from '../common/config'
import { logger } from 'onecore-utilities'

const propertyManagementServiceUrl = config.propertyInfoService.url

const getRentalProperty = async (
  rentalPropertyId: string
): Promise<RentalProperty> => {
  const propertyResponse = await axios(
    propertyManagementServiceUrl + '/rentalproperties/' + rentalPropertyId
  )

  return propertyResponse.data
}

//todo: this function needs to be refactored to use a pattern like "getRentalPropertyInfoFromXpand".
//todo: body is possible null from propertyManagementServiceUrl and without a status returned
//todo: its not possible for a caller to know what has gone wrong (or ok)
//todo: modify calling code to use a pattern like in "getRentalPropertyInfoFromXpand"
const getRentalPropertyInfo = async (
  rentalPropertyId: string
): Promise<RentalPropertyInfo> => {
  const propertyResponse = await axios(
    propertyManagementServiceUrl + '/rentalPropertyInfo/' + rentalPropertyId
  )

  return propertyResponse.data
}

//todo: copy of getRentalPropertyInfo above
//todo: added because callers needs to know more about the response than just the body
const getRentalPropertyInfoFromXpand = async (rentalPropertyId: string) => {
  const propertyResponse = await axios(
    propertyManagementServiceUrl + '/rentalPropertyInfo/' + rentalPropertyId
  )

  return {
    status: propertyResponse.status,
    data: propertyResponse.data,
  }
}

const getMaintenanceUnitsForRentalProperty = async (
  rentalPropertyId: string
): Promise<MaintenanceUnitInfo[]> => {
  const propertyResponse = await axios(
    propertyManagementServiceUrl + '/maintenanceUnits/' + rentalPropertyId
  )
  return propertyResponse.data
}

const getRoomTypeWithMaterialOptions = async (apartmentId: string) => {
  const materialOptionGroupsResponse = await axios(
    `${propertyManagementServiceUrl}/rentalproperties/${apartmentId}/material-options`
  )

  return materialOptionGroupsResponse.data
}
const getMaterialOption = async (
  apartmentId: string,
  materialOptionId: string
): Promise<MaterialOption | undefined> => {
  const materialOptionGroupsResponse = await axios(
    `${propertyManagementServiceUrl}/rentalproperties/${apartmentId}/material-options/${materialOptionId}`
  )

  return materialOptionGroupsResponse.data
}

const getRoomsWithMaterialChoices = async (apartmentId: string) => {
  const materialOptionGroupsResponse = await axios(
    `${propertyManagementServiceUrl}/rentalproperties/${apartmentId}/rooms-with-material-choices`
  )

  return materialOptionGroupsResponse.data
}

const getMaterialChoices = async (apartmentId: string, contractId?: string) => {
  let url

  if (contractId) {
    url = `${propertyManagementServiceUrl}/rentalproperties/${apartmentId}/${contractId}/material-choices`
  } else {
    url = `${propertyManagementServiceUrl}/rentalproperties/${apartmentId}/material-choices`
  }

  const materialOptionGroupsResponse = await axios(url)

  return materialOptionGroupsResponse.data
}

const getMaterialChoiceStatuses = async (projectCode: string) => {
  const materialOptionGroupsResponse = await axios(
    `${propertyManagementServiceUrl}/rentalproperties/material-choice-statuses?projectCode=${projectCode}`
  )

  return materialOptionGroupsResponse.data
}

const saveMaterialChoice = async (
  rentalPropertyId: string,
  materialChoices: Array<MaterialChoice>
) => {
  await axios(
    `${propertyManagementServiceUrl}/rentalproperties/${rentalPropertyId}/material-choices`,
    {
      method: 'post',
      data: materialChoices,
    }
  ).then((result) => {
    return result
  })
}

//todo: refactor the subsequent requests to use same data source (soap api)
//todo: getParkingSpace uses the mimer.nu api
//todo: getPublishedParkingSpace uses the soap service
const getParkingSpace = async (
  parkingSpaceId: string
): Promise<ParkingSpace | undefined> => {
  try {
    const parkingSpaceResponse = await axios(
      `${propertyManagementServiceUrl}/parkingspaces/${parkingSpaceId}`
    )

    return parkingSpaceResponse.data
  } catch (error) {
    logger.error(error, 'Error retrieving parking space')
    return undefined
  }
}

const getPublishedParkingSpace = async (
  parkingSpaceId: string
): Promise<Listing | undefined> => {
  try {
    const parkingSpaceResponse = await axios(
      `${propertyManagementServiceUrl}/publishedParkingSpaces/${parkingSpaceId}`
    )

    return parkingSpaceResponse.data
  } catch (error) {
    logger.error(error, 'Error retrieving parking space')
    return undefined
  }
}

export {
  getRentalProperty,
  getRentalPropertyInfo,
  getMaintenanceUnitsForRentalProperty,
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoices,
  getMaterialChoiceStatuses,
  saveMaterialChoice,
  getRoomsWithMaterialChoices,
  getParkingSpace,
  getPublishedParkingSpace,
  getRentalPropertyInfoFromXpand,
}
