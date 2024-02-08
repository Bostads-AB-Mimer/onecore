import axios from 'axios'
import { MaterialChoice, MaterialOption, RentalProperty } from 'onecore-types'
import config from '../../../common/config'

const propertyInfoServiceUrl = config.propertyInfoService.url

const getRentalProperty = async (
  rentalPropertyId: string
): Promise<RentalProperty> => {
  const propertyResponse = await axios(
    propertyInfoServiceUrl + '/rentalproperties/' + rentalPropertyId
  )

  return propertyResponse.data
}

const getRoomTypeWithMaterialOptions = async (apartmentId: string) => {
  const materialOptionGroupsResponse = await axios(
    `${propertyInfoServiceUrl}/rentalproperties/${apartmentId}/material-options`
  )

  return materialOptionGroupsResponse.data
}
const getMaterialOption = async (
  apartmentId: string,
  materialOptionId: string
): Promise<MaterialOption | undefined> => {
  const materialOptionGroupsResponse = await axios(
    `${propertyInfoServiceUrl}/rentalproperties/${apartmentId}/material-options/${materialOptionId}`
  )

  return materialOptionGroupsResponse.data
}

const getRoomsWithMaterialChoices = async (apartmentId: string) => {
  const materialOptionGroupsResponse = await axios(
    `${propertyInfoServiceUrl}/rentalproperties/${apartmentId}/rooms-with-material-choices`
  )

  return materialOptionGroupsResponse.data
}

const getMaterialChoices = async (apartmentId: string, contractId?: string) => {
  let url

  if (contractId) {
    url = `${propertyInfoServiceUrl}/rentalproperties/${apartmentId}/${contractId}/material-choices`
  } else {
    url = `${propertyInfoServiceUrl}/rentalproperties/${apartmentId}/material-choices`
  }

  const materialOptionGroupsResponse = await axios(url)

  return materialOptionGroupsResponse.data
}

const getMaterialChoiceStatuses = async (projectCode: string) => {
  const materialOptionGroupsResponse = await axios(
    `${propertyInfoServiceUrl}/rentalproperties/material-choice-statuses?projectCode=${projectCode}`
  )

  return materialOptionGroupsResponse.data
}

const saveMaterialChoice = async (
  rentalPropertyId: string,
  materialChoices: Array<MaterialChoice>
) => {
  await axios(
    `${propertyInfoServiceUrl}/rentalproperties/${rentalPropertyId}/material-choices`,
    {
      method: 'post',
      data: materialChoices,
    }
  ).then((result) => {
    return result
  })
}

export {
  getRentalProperty,
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoices,
  getMaterialChoiceStatuses,
  saveMaterialChoice,
  getRoomsWithMaterialChoices,
}
