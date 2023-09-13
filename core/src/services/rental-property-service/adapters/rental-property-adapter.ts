import axios from 'axios'
import {
  MaterialChoice,
  MaterialOption,
  RentalProperty,
} from '../../../common/types'
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

const getMaterialChoices = async (apartmentId: string) => {
  const materialOptionGroupsResponse = await axios(
    `${propertyInfoServiceUrl}/rentalproperties/${apartmentId}/material-choices`
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
    // console.log('result', result)
    return result
  })
}

export {
  getRentalProperty,
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoices,
  saveMaterialChoice,
}
