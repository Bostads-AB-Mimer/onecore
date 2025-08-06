import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'

const coreBaseUrl = Config.core.url

const getMaterialChoiceStatuses = async (projectCode: string) => {
  const materialChoiceStatusResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/propertymanagement/rentalproperties/material-choice-statuses?projectCode=${projectCode}&includeRentalProperties=false`,
  })

  return materialChoiceStatusResponse.data.content
}

const getMaterialChoices = async (apartmentId: string, contractId?: string) => {
  let url

  if (contractId) {
    url = `${coreBaseUrl}/propertymanagement/rentalproperties/${apartmentId}/contracts/${contractId}/material-choices`
  } else {
    url = `${coreBaseUrl}/propertymanagement/rentalproperties/${apartmentId}/material-choices`
  }

  const committedChoicesResponse = await getFromCore({
    method: 'get',
    url: url,
  })

  return committedChoicesResponse.data.content
}

export { getMaterialChoiceStatuses, getMaterialChoices }
