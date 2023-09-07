import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Contact, Lease, MaterialOption } from '../types'
import Config from '../../../common/config'
import { RentalProperty, RoomType, MaterialOptionGroup } from '../types'

const coreBaseUrl = Config.core.url
const coreUsername = Config.core.username
const corePassword = Config.core.password
let accessToken: string | undefined = undefined

const getAccessToken = async () => {
  const config = {
    method: 'post',
    url: `${coreBaseUrl}/auth/generatetoken`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      username: coreUsername,
      password: corePassword,
    },
  }

  const result = await axios(config)

  return result.data.token
}

const createHeaders = (accessToken: string) => {
  const headers = {
    Authorization: 'Bearer ' + accessToken,
  }

  return headers
}

const getFromCore = async (
  config: AxiosRequestConfig<any>
): Promise<AxiosResponse<any, any>> => {
  if (!accessToken) {
    accessToken = await getAccessToken()
  }

  try {
    config.headers = createHeaders(accessToken ?? '')

    return await axios(config)
  } catch (error) {
    const axiosErr = error as AxiosError

    if (axiosErr.response?.status === 401) {
      accessToken = await getAccessToken()
      return await getFromCore(config)
    }

    throw error
  }
}

const getContact = async (
  nationalRegistrationNumber: string
): Promise<Contact> => {
  const contactResponse = await getFromCore({
    method: 'get',
    url: coreBaseUrl + '/contact/' + nationalRegistrationNumber,
  })

  return contactResponse.data.data
}

const getLease = async (nationalRegistrationNumber: string): Promise<Lease> => {
  const leaseResponse = await getFromCore({
    method: 'get',
    url: coreBaseUrl + '/leases/for/' + nationalRegistrationNumber,
  })

  return leaseResponse.data.data[0]
}

const getApartment = async (
  rentalPropertyId: string
): Promise<RentalProperty> => {
  const leaseResponse = await getFromCore({
    method: 'get',
    url: coreBaseUrl + '/rentalproperties/' + rentalPropertyId,
  })

  return leaseResponse.data.data
}

const getFloorPlanStream = async (rentalPropertyId: string) => {
  const url = `${Config.core.url}/rentalproperties/${rentalPropertyId}/floorplan`

  const response = await getFromCore({
    method: 'get',
    url: url,
    responseType: 'stream',
  })

  return response
}

const getMaterialOptions = async (
  apartmentId: string
): Promise<Array<MaterialOptionGroup>> => {
  const materialOptionsResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/rentalproperties/${apartmentId}/material-options`,
  })

  return materialOptionsResponse.data
}

const getMaterialOptionGroup = async (
  roomTypeId: string,
  materialOptionGroupId: string
): Promise<MaterialOptionGroup | undefined> => {
  const materialOptionGroupResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/room-types/${roomTypeId}/material-option-groups/${materialOptionGroupId}`,
  })

  return materialOptionGroupResponse.data
}

const getMaterialOption = async (
  roomTypeId: string,
  materialOptionGroupId: string,
  materialOptionId: string
): Promise<MaterialOption | undefined> => {
  const materialOptionResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/room-types/${roomTypeId}/material-option-groups/${materialOptionGroupId}/options/${materialOptionId}`,
  })

  return materialOptionResponse.data
}

const getRoomTypes = async (apartmentId: string): Promise<Array<RoomType>> => {
  const roomTypesResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/rentalproperties/${apartmentId}/room-types`,
  })

  return roomTypesResponse.data
}

const getRoomType = async (
  apartmentId: string,
  roomTypeId: string
): Promise<RoomType | undefined> => {
  const roomTypes = await getRoomTypes(apartmentId)

  return roomTypes.find(
    (roomType: RoomType) => roomType.roomTypeId == roomTypeId
  )
}

const getMaterialOptionGroupsByRoomType = async (
  roomTypeId: string
): Promise<Array<MaterialOptionGroup>> => {
  const roomTypesResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/room-types/${roomTypeId}/material-option-groups`,
  })

  return roomTypesResponse.data
}

const getMaterialChoices = async (apartmentId: string) => {
  const materialChoicesResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/rentalproperties/${apartmentId}/material-choices`,
  })

  return materialChoicesResponse.data
}

export {
  getApartment,
  getFloorPlanStream,
  getLease,
  getRoomType,
  getRoomTypes,
  getContact,
  getMaterialOptions,
  getMaterialOptionGroup,
  getMaterialOption,
  getMaterialOptionGroupsByRoomType,
  getMaterialChoices,
}
