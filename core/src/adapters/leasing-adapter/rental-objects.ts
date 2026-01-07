import { loggedAxios as axios, logger } from '@onecore/utilities'
import { RentalObject } from '@onecore/types'

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
      logger.error({ rentalObjectCode }, 'Parking space not found for code:')
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
  rentalObjectCodes?: string[]
): Promise<AdapterResult<RentalObject[], 'not-found' | 'unknown'>> => {
  try {
    const url = `${tenantsLeasesServiceUrl}/parking-spaces`

    const requestBody = rentalObjectCodes?.length
      ? { includeRentalObjectCodes: rentalObjectCodes }
      : undefined

    const response = await axios.post(url, requestBody)

    if (response.status === 404) {
      logger.error(
        `Parking space not found for codes: ${rentalObjectCodes?.join(', ')}`
      )
      return { ok: false, err: 'not-found' }
    }
    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(
      error,
      `Error retrieving rental objects by codes ${rentalObjectCodes?.join(', ')}`
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

const getRentalObjectRentByCode = async (
  rentalObjectCode: string
): Promise<AdapterResult<number, 'rent-not-found' | 'unknown'>> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/rental-objects/by-code/${rentalObjectCode}/rent`
    )
    if (response.status === 404) {
      logger.error(
        { rentalObjectCode },
        'Rental object rent not found for code:'
      )
      return { ok: false, err: 'rent-not-found' }
    }
    return { ok: true, data: response.data.rent }
  } catch (error) {
    logger.error(
      error,
      `Error retrieving rental object rent by code: ${rentalObjectCode}`
    )
    return { ok: false, err: 'unknown' }
  }
}

export {
  getAllVacantParkingSpaces,
  getParkingSpaceByCode,
  getParkingSpaces,
  getRentalObjectRentByCode,
}
