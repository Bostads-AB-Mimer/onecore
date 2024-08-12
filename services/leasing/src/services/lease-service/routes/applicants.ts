import KoaRouter from '@koa/router'
import { z } from 'zod'
import { ApplicantStatus } from 'onecore-types'
import { logger } from 'onecore-utilities'

import {
  getApplicantByContactCodeAndListingId,
  getApplicantById,
  getApplicantsByContactCode,
  updateApplicantStatus,
} from '../adapters/listing-adapter'
import { getEstateCodeFromXpandByRentalObjectCode } from '../adapters/xpand/estate-code-adapter'
import {
  doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules,
  doesTenantHaveHousingContractInSamePropertyAsListing,
} from '../property-rental-rules-validator'
import { getTenant } from '../get-tenant'
import {
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
  isHousingContractsOfApplicantInSameAreaAsListing,
  isListingInAreaWithSpecificRentalRules,
} from '../residential-area-rental-rules-validator'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

/**
 * @swagger
 * tags:
 *   - name: Applicants
 *     description: Endpoints related to applicant operations
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /applicants/{contactCode}/:
   *   get:
   *     summary: Get applicant based on contact code
   *     description: Fetches a list of applicants associated with a given contact code.
   *     tags: [Applicants]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the applicants to retrieve.
   *     responses:
   *       200:
   *         description: A list of applicants associated with the contact code.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: No applicant found for the provided contact code.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Applicant not found for the provided contactCode.
   *       500:
   *         description: An error occurred while fetching the applicant.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: An error occurred while fetching the applicant.
   */
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

  /**
   * @swagger
   * /applicants/{contactCode}/{listingId}:
   *   get:
   *     summary: Get applicant by contact code and listing id
   *     description: Fetch an applicant by contact code and listing ID.
   *     tags: [Applicants]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the applicant to retrieve.
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: integer
   *         description: The listing ID associated with the applicant.
   *     responses:
   *       200:
   *         description: An applicant associated with the contact code and listing ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   description: The unique ID of the applicant.
   *                 name:
   *                   type: string
   *                   description: The name of the applicant.
   *                 email:
   *                   type: string
   *                   description: The email address of the applicant.
   *                 listingId:
   *                   type: integer
   *                   description: The listing ID associated with the applicant.
   *       404:
   *         description: No applicant found for the provided contact code and listing ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Applicant not found for the provided contactCode and listingId.
   *       500:
   *         description: An error occurred while fetching the applicant.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: An error occurred while fetching the applicant.
   */
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

  /**
   * @swagger
   * /applicants/{id}/status:
   *   patch:
   *     summary: Update applicant status
   *     description: Update the status of an applicant.
   *     tags: [Applicants]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [Pending, Approved, Rejected, WithdrawnByUser, WithdrawnByAdmin]
   *                 description: The new status of the applicant.
   *               contactCode:
   *                 type: string
   *                 description: The contact code of the applicant. Required if status is WithdrawnByUser.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: The unique ID of the applicant.
   *     responses:
   *       200:
   *         description: Applicant status updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Applicant status updated successfully.
   *       404:
   *         description: Applicant not found or mismatch in contact code for status WithdrawnByUser.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   examples:
   *                     applicantNotFound:
   *                       value: Applicant not found.
   *                     contactCodeMismatch:
   *                       value: Applicant not found for this contactCode.
   *       500:
   *         description: An error occurred while updating the applicant status.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: An error occurred while updating the applicant status.
   */
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

  /**
   * @swagger
   * /applicants/validatePropertyRentalRules/{contactCode}/{listingId}:
   *   get:
   *     summary: Validate property rental rules for applicant
   *     description: Validate property rental rules for an applicant based on contact code and listing ID.
   *     tags: [Applicants]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the applicant.
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: integer
   *         description: The listing ID to validate against.
   *     responses:
   *       200:
   *         description: No property rental rules apply to this listing.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: No property rental rules applies to this listing.
   *       403:
   *         description: Applicant is not eligible for the listing based on property rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   examples:
   *                     notTenant:
   *                       value: Applicant is not a current or coming tenant in the property.
   *                     noParkingContracts:
   *                       value: User does not have any active parking space contracts in the listings residential area.
   *       404:
   *         description: Listing, property info, or applicant not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   examples:
   *                     listingNotFound:
   *                       value: Listing was not found.
   *                     propertyInfoNotFound:
   *                       value: Property info for listing was not found.
   *                     applicantNotFound:
   *                       value: Applicant was not found.
   *                     contactCodeMismatch:
   *                       value: Applicant not found for this contactCode.
   *       409:
   *         description: User already has an active parking space contract in the listing's residential area.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: User already have an active parking space contract in the listings residential area.
   *       500:
   *         description: An error occurred while validating property rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: An error occurred while validating property rental rules.
   */
  router.get(
    '(.*)/applicants/validatePropertyRentalRules/:contactCode/:rentalObjectCode',
    async (ctx) => {
      try {
        const { contactCode, rentalObjectCode } = ctx.params

        const propertyInfo =
          await getEstateCodeFromXpandByRentalObjectCode(rentalObjectCode)

        if (!propertyInfo) {
          ctx.status = 404
          return
        }

        if (propertyInfo.type !== 'babps') {
          ctx.status = 400
          ctx.body = {
            reason: 'Rental object code entity is not a parking space',
          }
        }

        if (
          !doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules(
            propertyInfo.estateCode
          )
        ) {
          ctx.status = 200
          ctx.body = {
            applicationType: 'Additional',
            reason: 'No property rental rules applies to this parking space',
          }
          return
        }

        const contact = await getTenant({ contactCode })

        if (!contact.ok) {
          ctx.status = 500
          ctx.body = 'Internal Error'
          return
        }

        const subjectHasHousingContractInSamePropertyAsListing =
          await doesTenantHaveHousingContractInSamePropertyAsListing(
            contact.data,
            propertyInfo.estateCode
          )

        if (!subjectHasHousingContractInSamePropertyAsListing) {
          ctx.status = 403
          ctx.body = {
            reason: 'User is not a current or coming tenant in the property',
          }
          return
        }

        //if subject has no parking space contracts but is a tenant in the property
        if (!contact.data.parkingSpaceContracts?.length) {
          //subject is eligible for parking space, applicationType for application should be 'additonal'
          ctx.status = 200
          ctx.body = {
            applicationType: 'Additional',
            reason:
              'User is a tenant in the property and does not have any active parking space contracts in the listings residential area. User is eligible to apply with applicationType additional.',
          }
          return
        }

        const getParkingSpacePropertyInfo =
          contact.data.parkingSpaceContracts.map((lease) =>
            getEstateCodeFromXpandByRentalObjectCode(lease.rentalPropertyId)
          )

        const parkingSpaceEstateCodes = await Promise.all(
          getParkingSpacePropertyInfo
        ).then((res) => res.filter(Boolean).map((r) => r?.estateCode))

        const subjectNeedsToReplaceParkingSpace = parkingSpaceEstateCodes.some(
          (v) => v === propertyInfo.estateCode
        )

        if (subjectNeedsToReplaceParkingSpace) {
          ctx.status = 200
          ctx.body = {
            applicationType: 'Replace',
            reason:
              'User already have an active parking space contract in the listings residential area. User is eligible to apply with applicationType Replace.',
          }
          return
        }

        //user has parking space contracts but none in the same property as the listing
        ctx.status = 200
        ctx.body = {
          applicationType: 'Additional',
          reason:
            'User is a tenant in the property and does not have any active parking space contracts in the listings residential area. User is eligible to apply with applicationType additional.',
        }
      } catch (error: unknown) {
        ctx.status = 500

        if (error instanceof Error) {
          logger.error(
            { err: error },
            'Error when validating residential rules'
          )
          ctx.body = {
            error: error.message,
          }
        }
      }
    }
  )

  /**
   * @swagger
   * /applicants/validateResidentialAreaRentalRules/{contactCode}/{listingId}:
   *   get:
   *     summary: Validate residential area rental rules for applicant
   *     description: Validate residential area rental rules for an applicant based on contact code and listing ID.
   *     tags: [Applicants]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the applicant.
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: integer
   *         description: The listing ID to validate against.
   *     responses:
   *       200:
   *         description: No residential area rental rules apply or applicant is eligible to apply for parking space.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   examples:
   *                     noRules:
   *                       value: No residential area rental rules applies to this listing.
   *                     eligible:
   *                       value: Applicant does not have any active parking space contracts in the listings residential area. Applicant is eligible to apply to parking space.
   *       403:
   *         description: Applicant is not eligible for the listing based on residential area rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Applicant does not have any current or upcoming housing contracts in the residential area.
   *       404:
   *         description: Listing or applicant not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   examples:
   *                     listingNotFound:
   *                       value: Listing was not found.
   *                     applicantNotFound:
   *                       value: Applicant was not found.
   *       409:
   *         description: User already has an active parking space contract in the listing's residential area.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Applicant already have an active parking space contract in the listings residential area.
   *       500:
   *         description: An error occurred while validating residential area rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: An error occurred while validating residential area rental rules.
   */
  router
  router.get(
    '(.*)/applicants/validateResidentialAreaRentalRules/:contactCode/:districtCode',
    async (ctx) => {
      try {
        const { contactCode, districtCode } = ctx.params

        if (!isListingInAreaWithSpecificRentalRules(districtCode)) {
          ctx.status = 200
          ctx.body = {
            applicationType: 'Additional',
            reason:
              'No residential area rental rules applies to this parking space',
          }
          return
        }

        const contact = await getTenant({ contactCode })

        if (!contact.ok) {
          ctx.status = 500
          return
        }

        if (
          !isHousingContractsOfApplicantInSameAreaAsListing(
            districtCode,
            contact.data
          )
        ) {
          ctx.status = 403
          ctx.body = {
            reason:
              'Subject does not have any current or upcoming housing contracts in the residential area',
          }
          return
        }

        const doesUserHaveExistingParkingSpaceInSameAreaAsListing =
          doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
            districtCode,
            contact.data
          )

        if (!doesUserHaveExistingParkingSpaceInSameAreaAsListing) {
          //applicant is eligible for parking space, applicationType for application should be 'additonal'
          ctx.status = 200
          ctx.body = {
            applicationType: 'Additional',
            reason:
              'Subject does not have any active parking space contracts in the listings residential area. Subject is eligible to apply to parking space with applicationType additional.',
          }
          return
        }

        //applicant have an active parking space contract in the same area as the listing
        //only option is to replace that parking space contract
        ctx.status = 200
        ctx.body = {
          applicationType: 'Replace',
          reason:
            'Subject already have an active parking space contract in the listings residential area. Subject is eligible to apply to parking space with applicationType replace.',
        }
      } catch (err: unknown) {
        logger.error(err, 'Error when validating residential rental rules')

        ctx.status = 500
        if (err instanceof Error) {
          ctx.body = {
            error: err.message,
          }
        }
      }
    }
  )
}
