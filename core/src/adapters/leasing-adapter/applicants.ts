import { AxiosError } from 'axios'
import { logger, loggedAxios as axios } from '@onecore/utilities'
import {
  Applicant,
  ApplicantStatus,
  ApplicantWithListing,
  DetailedApplicant,
} from '@onecore/types'

import { AdapterResult } from '../types'
import config from '../../common/config'
import { getListingByListingId } from './listings'
import { getParkingSpaces } from './rental-objects'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

export const getDetailedApplicantsByListingId = async (
  listingId: number
): Promise<AdapterResult<DetailedApplicant[], 'unknown' | 'not-found'>> => {
  try {
    const response = await axios(
      `${tenantsLeasesServiceUrl}/listing/${listingId}/applicants/details`
    )

    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(error, 'Error fetching detailed applicant data by listing id')

    if (!(error instanceof AxiosError)) {
      return { ok: false, err: 'unknown' }
    }

    if (error.response?.status === 404) {
      return { ok: false, err: 'not-found' }
    } else {
      return { ok: false, err: 'unknown' }
    }
  }
}

export const setApplicantStatusActive = async (
  applicantId: string,
  contactCode: string,
  applicationType?: 'Replace' | 'Additional'
): Promise<any> => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${applicantId}/status`,
      {
        status: ApplicantStatus.Active,
        contactCode: contactCode,
        applicationType,
      }
    )
    return response.data
  } catch (error) {
    logger.error(
      error,
      `Error setting applicantStatus active on user with contactcode ${contactCode}`
    )
    throw new Error(`Failed to update status for applicant ${applicantId}`)
  }
}

export const withdrawApplicantByManager = async (
  applicantId: string
): Promise<any> => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${applicantId}/status`,
      { status: ApplicantStatus.WithdrawnByManager }
    )
    return response.data
  } catch (error) {
    logger.error(error, 'Error patching applicant status:')
    throw new Error(`Failed to update status for applicant ${applicantId}`)
  }
}

export const withdrawApplicantByUser = async (
  applicantId: string,
  contactCode: string
): Promise<any> => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${applicantId}/status`,
      { status: ApplicantStatus.WithdrawnByUser, contactCode: contactCode }
    )
    return response.data
  } catch (error) {
    logger.error(error, 'Error withdrawing applicant by user:')
    return undefined
  }
}

export const updateApplicantStatus = async (params: {
  contactCode: string
  applicantId: number
  status: ApplicantStatus
}) => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${params.applicantId}/status`,
      params
    )
    return response.data
  } catch (err) {
    logger.error(err, 'Error updating applicant status')
    throw err
  }
}

export const validateResidentialAreaRentalRules = async (
  contactCode: string,
  districtCode: string
): Promise<
  AdapterResult<
    { reason: string; applicationType: 'Replace' | 'Additional' },
    {
      tag: 'no-housing-contract-in-the-area' | 'not-found' | 'unknown'
      data: unknown
    }
  >
> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/applicants/validateResidentialAreaRentalRules/${contactCode}/${districtCode}`
    )
    if (res.status === 403) {
      return {
        ok: false,
        err: { tag: 'no-housing-contract-in-the-area', data: res.data },
      }
    }

    if (res.status === 404) {
      return {
        ok: false,
        err: { tag: 'not-found', data: res.data },
      }
    }

    if (res.status !== 200) {
      return { ok: false, err: { tag: 'unknown', data: res.data } }
    }

    return { ok: true, data: res.data }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.validateResidentialAreaRentalRules')
    return { ok: false, err: { tag: 'unknown', data: err } }
  }
}

export const validatePropertyRentalRules = async (
  contactCode: string,
  rentalObjectCode: string
): Promise<
  AdapterResult<
    { reason: string; applicationType: 'Replace' | 'Additional' },
    {
      tag:
        | 'not-tenant-in-the-property'
        | 'not-a-parking-space'
        | 'not-found'
        | 'unknown'
      data: unknown
    }
  >
> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/applicants/validatePropertyRentalRules/${contactCode}/${rentalObjectCode}`
    )

    if (res.status === 404) {
      return { ok: false, err: { tag: 'not-found', data: res.data } }
    }

    if (res.status === 400) {
      return { ok: false, err: { tag: 'not-a-parking-space', data: res.data } }
    }

    if (res.status === 403) {
      return {
        ok: false,
        err: { tag: 'not-tenant-in-the-property', data: res.data },
      }
    }

    return { ok: true, data: res.data }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.validatePropertyRentalRules')
    return { ok: false, err: { tag: 'unknown', data: err } }
  }
}

export const getApplicantsByContactCode = async (
  contactCode: string
): Promise<any[] | undefined> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/applicants/${contactCode}/`
    )
    return response.data.content
  } catch (error) {
    logger.error(error, 'Error fetching applicants by contact code:')
    return undefined
  }
}

export const getApplicantsAndListingByContactCode = async (
  contactCode: string
): Promise<any[] | undefined> => {
  try {
    const applicantsResponse = (await getApplicantsByContactCode(
      contactCode
    )) as Applicant[]

    if (!applicantsResponse || applicantsResponse.length === 0) {
      return []
    }

    // Fetch all listings in parallel
    const listingsPromises = applicantsResponse.map((applicant) =>
      getListingByListingId(applicant.listingId)
    )
    const listingsResults = await Promise.all(listingsPromises)

    // Create a map of listingId -> listing for easy lookup
    const listingsMap = new Map()
    listingsResults.forEach((listing, index) => {
      if (listing) {
        listingsMap.set(applicantsResponse[index].listingId, listing)
      }
    })

    // Collect all rental object codes from listings
    const rentalObjectCodes = Array.from(listingsMap.values())
      .map((listing) => listing.rentalObjectCode)
      .filter(Boolean)

    // Fetch all rental objects
    const parkingSpacesMap = new Map()
    const parkingSpaceResult = await getParkingSpaces(rentalObjectCodes)

    if (!parkingSpaceResult.ok || !parkingSpaceResult.data) {
      logger.error(
        { rentalObjectCodes, contactCode },
        'getApplicantsAndListingByContactCode: Could not fetch rental object for listing'
      )
    } else {
      // Create a map of rentalObjectCode -> parking space
      parkingSpaceResult.data.forEach((rentalObject) => {
        parkingSpacesMap.set(rentalObject.rentalObjectCode, rentalObject)
      })
    }

    // Build the final result with applicants, listings, and rental objects
    const applicantsAndListings: ApplicantWithListing[] = []
    for (const applicant of applicantsResponse) {
      const listing = listingsMap.get(applicant.listingId)
      if (listing) {
        const rentalObject = parkingSpacesMap.get(listing.rentalObjectCode)
        const listingWithRentalObject = rentalObject
          ? { ...listing, rentalObject }
          : listing

        applicantsAndListings.push({
          applicant,
          listing: listingWithRentalObject,
        })
      }
    }

    return applicantsAndListings
  } catch (error) {
    logger.error(
      error,
      'Error fetching applicants and listings by contact code:'
    )
    return undefined
  }
}

export const getApplicantByContactCodeAndListingId = async (
  contactCode: string,
  listingId: string
): Promise<any | undefined> => {
  try {
    return await axios.get(
      `${tenantsLeasesServiceUrl}/applicants/${contactCode}/${listingId}`
    )
  } catch (error) {
    logger.error(
      error,
      'Error fetching applicant by contact code and rental object code'
    )
    return undefined
  }
}
