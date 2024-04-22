import Config from '../../../common/config'
import {getFromCore} from "../../common/adapters/core-adapter";

const coreBaseUrl = Config.core.url

const getListingsWithApplicants = async () => {
  const url = `${coreBaseUrl}/listings-with-applicants`
  const listingsResponse = await getFromCore({
    method: 'get',
    url: url
  })

  return listingsResponse.data
}
export { getListingsWithApplicants }
