import axios from 'axios'
import {
  MaterialChoice,
  MaterialOption,
  ParkingSpace,
  RentalProperty,
} from 'onecore-types'
import config from '../common/config'

const propertyManagementServiceUrl = config.propertyInfoService.url

const getRentalProperty = async (
  rentalPropertyId: string
): Promise<RentalProperty> => {
  const propertyResponse = await axios(
    propertyManagementServiceUrl + '/rentalproperties/' + rentalPropertyId
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

const getParkingSpace = async (
  parkingSpaceId: string
): Promise<ParkingSpace | undefined> => {
  try {
    const parkingSpaceResponse = await axios(
      `${propertyManagementServiceUrl}/parkingspaces/${parkingSpaceId}`
    )

    return parkingSpaceResponse.data
  } catch (error) {
    console.error('Error retrieving parking space', error)
    return undefined
  }
}

export {
  getRentalProperty,
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoices,
  getMaterialChoiceStatuses,
  saveMaterialChoice,
  getRoomsWithMaterialChoices,
  getParkingSpace,
}
