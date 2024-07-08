import KoaRouter from '@koa/router'
import {
  getApplicantByContactCodeAndListingId,
  getApplicantById,
  getApplicantsByContactCode,
  getListingById,
  updateApplicantStatus,
} from '../adapters/listing-adapter'
import { getEstateCodeFromXpandByRentalObjectCode } from '../adapters/xpand/estate-code-adapter'
import {
  doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules,
  doesUserHaveHousingContractInSamePropertyAsListing,
} from '../property-rental-rules-validator'
import { getDetailedApplicantInformation } from '../priority-list-service'
import { logger } from 'onecore-utilities'
import {
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
  isHousingContractsOfApplicantInSameAreaAsListing,
  isListingInAreaWithSpecificRentalRules,
} from '../residential-area-rental-rules-validator'
import { z } from 'zod'
import { ApplicantStatus } from 'onecore-types'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

export const routes = (router: KoaRouter) => {
  router.get('/applicants/:contactCode/', async (ctx) => {
    const { contactCode } = ctx.params // Extracting from URL parameters
    try {
      const applicants = await getApplicantsByContactCode(contactCode)
      ctx.body = applicants
      ctx.status = 200

      if (!applicants) {
        ctx.status = 404 // Not Found
        ctx.body = {
          error: 'Applicant not found for the provided contactCode.',
        }
      } else {
        ctx.status = 200 // OK
        ctx.body = applicants
      }
    } catch (error) {
      logger.error(error, 'Error fetching applicant by contactCode:')
      ctx.status = 500 // Internal Server Error
      ctx.body = { error: 'An error occurred while fetching the applicant.' }
    }
  })

  router.get('/applicants/:contactCode/:listingId', async (ctx) => {
    const { contactCode, listingId } = ctx.params // Extracting from URL parameters
    try {
      const applicant = await getApplicantByContactCodeAndListingId(
        contactCode,
        parseInt(listingId)
      )
      ctx.body = applicant
      ctx.status = 200

      if (!applicant) {
        ctx.status = 404 // Not Found
        ctx.body = {
          error:
            'Applicant not found for the provided contactCode and listingId.',
        }
      } else {
        ctx.status = 200 // OK
        ctx.body = applicant
      }
    } catch (error) {
      logger.error(
        error,
        'Error fetching applicant by contactCode and rentalObjectCode:'
      )
      ctx.status = 500 // Internal Server Error
      ctx.body = { error: 'An error occurred while fetching the applicant.' }
    }
  })

  const updateApplicantStatusParams = z.object({
    status: z.nativeEnum(ApplicantStatus),
    contactCode: z.string().optional(),
  })

  router.patch(
    '/applicants/:id/status',
    parseRequestBody(updateApplicantStatusParams),
    async (ctx) => {
      const { id } = ctx.params
      const { status, contactCode } = ctx.request.body

      try {
        //if the applicant is withdrawn by the user, make sure the application belongs to that particular user
        if (status === ApplicantStatus.WithdrawnByUser) {
          const applicant = await getApplicantById(Number(id))
          if (applicant?.contactCode !== contactCode) {
            ctx.status = 404
            ctx.body = { error: 'Applicant not found for this contactCode' }
            return
          }
        }

        const applicantUpdated = await updateApplicantStatus(Number(id), status)
        if (applicantUpdated) {
          ctx.status = 200
          ctx.body = { message: 'Applicant status updated successfully' }
        } else {
          ctx.status = 404
          ctx.body = { error: 'Applicant not found' }
        }
      } catch (error) {
        logger.error(error, 'Error updating applicant status')
        ctx.status = 500 // Internal Server Error
        ctx.body = {
          error: 'An error occurred while updating the applicant status.',
        }
      }
    }
  )

  router.get(
    '(.*)/applicants/validatePropertyRentalRules/:contactCode/:listingId',
    async (ctx) => {
      try {
        const { contactCode, listingId } = ctx.params // Extracting from URL parameters
        const listing = await getListingById(listingId)
        if (listing == undefined) {
          ctx.status = 404
          ctx.body = {
            reason: 'Listing was not found',
          }
          return
        }

        const listingEstateCode =
          await getEstateCodeFromXpandByRentalObjectCode(
            listing.rentalObjectCode
          )

        if (listingEstateCode == undefined) {
          ctx.status = 404
          ctx.body = {
            reason: 'Property info for listing was not found',
          }
          return
        }

        if (
          !doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules(
            listingEstateCode
          )
        ) {
          //special property rental rules does not apply to this listing
          ctx.body = {
            reason: 'No property rental rules applies to this listing',
          }
          ctx.status = 200
          return
        }

        const applicant = await getApplicantByContactCodeAndListingId(
          contactCode,
          parseInt(listingId)
        )

        if (applicant == undefined) {
          ctx.status = 404
          ctx.body = {
            reason: 'Applicant was not found',
          }
          return
        }

        const detailedApplicant =
          await getDetailedApplicantInformation(applicant)

        //1. fetch the estateCode for the applicant's current or upcoming housing contract
        //2. check that the housing contract(s) matches the listings estate code
        //3. if not, the user cannot apply for the parking space
        //todo: a better future scenario is to include the estate code in onecore database(s)
        //todo: a lot of this code could be simplified if we did not need to round trip to xpand to get the estate code
        const applicantHasHousingContractInSamePropertyAsListing =
          await doesUserHaveHousingContractInSamePropertyAsListing(
            detailedApplicant,
            listingEstateCode
          )

        if (!applicantHasHousingContractInSamePropertyAsListing) {
          ctx.body = {
            reason:
              'Applicant is not a current or coming tenant in the property',
          }
          ctx.status = 403
          return
        }

        //if applicant has no parking space contracts but is a tenant in the property
        if (
          !detailedApplicant.parkingSpaceContracts ||
          detailedApplicant.parkingSpaceContracts.length == 0
        ) {
          //applicant is eligible for parking space, applicationType for application should be 'additonal'
          ctx.body = {
            reason:
              'User does not have any active parking space contracts in the listings residential area',
          }
          ctx.status = 403
          return
        }

        //1. fetch the estateCode for each of the applicant's parking space contracts
        //validation:
        //2. Check if any of the users parking space contracts matches the listings estate code
        //3. if any parking space contract matches the listing estatecode, user needs to replace that parking space contract
        //4. else, the user can apply with applicationType 'additional'

        //todo: refactor and move to property rules validator?
        let applicantNeedsToReplaceContractToBeAbleToApply = false
        for (const parkingSpaceContract of detailedApplicant.parkingSpaceContracts) {
          //
          const parkingSpaceEstateCode =
            await getEstateCodeFromXpandByRentalObjectCode(
              parkingSpaceContract.rentalPropertyId
            )

          if (parkingSpaceEstateCode != undefined) {
            if (listingEstateCode == parkingSpaceEstateCode) {
              applicantNeedsToReplaceContractToBeAbleToApply = true
              break
            }
          }
        }

        if (applicantNeedsToReplaceContractToBeAbleToApply) {
          //applicant have an active parking space contract in the same property as the listing
          //only option is to replace that parking space contract
          ctx.body = {
            reason:
              'User already have an active parking space contract in the listings residential area',
          }
          ctx.status = 409
          return
        }

        //user has parking space contracts but none in the same property as the listing
        ctx.body = {
          reason:
            'User does not have any active parking space contracts in the listings residential area',
        }
        ctx.status = 403
      } catch (error: unknown) {
        ctx.status = 500

        if (error instanceof Error) {
          logger.error(
            { err: error },
            'error when validating residential rules'
          )
          ctx.body = {
            error: error.message,
          }
        }
      }
    }
  )

  router.get(
    '(.*)/applicants/validateResidentialAreaRentalRules/:contactCode/:listingId',
    async (ctx) => {
      try {
        const { contactCode, listingId } = ctx.params // Extracting from URL parameters
        const listing = await getListingById(listingId)

        if (listing == undefined) {
          ctx.status = 404
          ctx.body = {
            reason: 'Listing was not found',
          }
          return
        }

        if (!isListingInAreaWithSpecificRentalRules(listing)) {
          //special residential area rental rules does not apply to this listing
          ctx.status = 200
          ctx.body = {
            reason: 'No residential area rental rules applies to this listing',
          }
          return
        }

        const applicant = await getApplicantByContactCodeAndListingId(
          contactCode,
          parseInt(listingId)
        )

        if (applicant == undefined) {
          ctx.status = 404
          ctx.body = {
            reason: 'Applicant was not found',
          }
          return
        }

        const detailedApplicant =
          await getDetailedApplicantInformation(applicant)
        //validate listing area specific rental rules
        if (
          !isHousingContractsOfApplicantInSameAreaAsListing(
            listing,
            detailedApplicant
          )
        ) {
          // applicant does not have a housing contract in the same area as the listing
          ctx.body = {
            reason:
              'Applicant does not have any current or upcoming housing contracts in the residential area',
          }
          ctx.status = 403
          return
        }

        const doesUserHaveExistingParkingSpaceInSameAreaAsListing =
          doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
            listing,
            detailedApplicant
          )

        if (!doesUserHaveExistingParkingSpaceInSameAreaAsListing) {
          //applicant is eligible for parking space, applicationType for application should be 'additonal'
          ctx.body = {
            reason:
              'Applicant does not have any active parking space contracts in the listings residential area. Applicant is eligible to apply to parking space.',
          }
          ctx.status = 200
          return
        }

        //applicant have an active parking space contract in the same area as the listing
        //only option is to replace that parking space contract
        ctx.body = {
          reason:
            'Applicant already have an active parking space contract in the listings residential area',
        }
        ctx.status = 409
      } catch (error: unknown) {
        ctx.status = 500

        if (error instanceof Error) {
          logger.error(
            { err: error },
            'error when validating residential rules'
          )
          ctx.body = {
            error: error.message,
          }
        }
      }
    }
  )
}
