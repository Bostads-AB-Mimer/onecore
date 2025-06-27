import { loggedAxios as axios, logger } from 'onecore-utilities'
import { RentalObject } from 'onecore-types'
import { HttpStatusCode } from 'axios'

import config from '../../common/config'
import { AdapterResult } from '../types'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

const getParkingSpaceByCode = async (
  rentalObjectCode: string
): Promise<AdapterResult<RentalObject, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/parking-spaces/by-code/${rentalObjectCode}`
    )
    if (response.status === 404) {
      logger.error('Parking space not found for code:', rentalObjectCode)
      return { ok: false, err: 'not-found' }
    }
    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(
      error,
      `Error retrieving rental object by code: ${rentalObjectCode}`
    )
    return { ok: false, err: 'unknown' }
  }
}

const getParkingSpaces = async (
  includeRentalObjectCodes?: string[]
): Promise<AdapterResult<RentalObject[], 'not-found' | 'unknown'>> => {
  try {
    let url = `${tenantsLeasesServiceUrl}/parking-spaces`

    if (includeRentalObjectCodes && includeRentalObjectCodes.length) {
      const codesParam = includeRentalObjectCodes.join(',')
      url += `?includeRentalObjectCodes=${encodeURIComponent(codesParam)}`
    }

    const response = await axios.get(url)

    if (response.status === 404) {
      logger.error(
        `Parking space not found for codes: ${includeRentalObjectCodes?.join(', ')}`
      )
      return { ok: false, err: 'not-found' }
    }
    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(
      error,
      `Error retrieving rental objects by codes ${includeRentalObjectCodes?.join(', ')}`
    )
    return { ok: false, err: 'unknown' }
  }
}

const getAllVacantParkingSpaces = async (): Promise<
  AdapterResult<RentalObject[], 'get-all-vacant-parking-spaces-failed'>
> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/vacant-parkingspaces`
    )
    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(error, 'Error fetching vacant-parkingspaces:')
    return { ok: false, err: 'get-all-vacant-parking-spaces-failed' }
  }
}

const getParkingSpaceByRentalObjectCode = async (
  rentalObjectCode: string
): Promise<
  AdapterResult<
    RentalObject,
    'get-rental-object-failed' | 'rental-object-not-found'
  >
> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/parking-spaces/by-code/${rentalObjectCode}`
    )
    if (response.status == HttpStatusCode.NotFound) {
      return { ok: false, err: 'rental-object-not-found' }
    }
    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(
      error,
      'getParkingSpaceByRentalObjectCode. Error fetching rentalobject:'
    )
    return { ok: false, err: 'get-rental-object-failed' }
  }
}

export {
  getAllVacantParkingSpaces,
  getParkingSpaceByRentalObjectCode,
  getParkingSpaceByCode,
  getParkingSpaces,
}
