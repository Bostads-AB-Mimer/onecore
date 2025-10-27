import { HttpStatusCode } from 'axios'
import {
  parkingSpaceApplicationCategoryTranslation,
  Applicant,
  ApplicantStatus,
  Contact,
  Listing,
  CreateNoteOfInterestErrorCodes,
  WaitingListType,
} from '@onecore/types'
import { logger } from '@onecore/utilities'

import {
  addApplicantToWaitingList,
  getActiveListingByRentalObjectCode,
  createNewListing,
  applyForListing,
  setApplicantStatusActive,
  getApplicantByContactCodeAndListingId,
  validateResidentialAreaRentalRules,
  validatePropertyRentalRules,
  getContactByContactCode,
  getLeasesForContactCode,
} from '../../../adapters/leasing-adapter'
import { getPublishedParkingSpace } from '../../../adapters/property-management-adapter'
import {
  ProcessError,
  ProcessResult,
  ProcessStatus,
} from '../../../common/types'
import { makeProcessError, validateRentalRules } from '../utils'
import { sendNotificationToRole } from '../../../adapters/communication-adapter'
import { getInvoicesSentToDebtCollection } from '../../../adapters/economy-adapter'

// PROCESS Part 1 - Create Note of Interest for Scored Parking Space
export const createNoteOfInterestForInternalParkingSpace = async (
  parkingSpaceId: string,
  contactCode: string,
  applicationType: 'Replace' | 'Additional'
): Promise<ProcessResult<any, any>> => {
  const log: string[] = [
    `Ansökan om intern bilplats`,
    `Tidpunkt för ansökan: ${new Date()
      .toISOString()
      .substring(0, 16)
      .replace('T', ' ')}`,
    `Sökande ${contactCode} har ansökt om bilplats ${parkingSpaceId}`,
  ]

  try {
    const parkingSpace = await getPublishedParkingSpace(parkingSpaceId)
    // step 1 - get parking space
    if (!parkingSpace || !parkingSpace.rentalObject.residentialAreaCode) {
      return endFailingProcess(
        log,
        CreateNoteOfInterestErrorCodes.ParkingspaceNotFound,
        404,
        `The parking space ${parkingSpaceId} does not exist or is no longer available.`
      )
    }
    if (parkingSpace.rentalRule !== 'SCORED') {
      return endFailingProcess(
        log,
        CreateNoteOfInterestErrorCodes.ParkingspaceNotInternal,
        400,
        `This process currently only handles internal parking spaces. The parking space provided is not internal (it is ${parkingSpace.rentalRule}, ${parkingSpaceApplicationCategoryTranslation.internal}).`
      )
    }

    // Step 2. Get information about applicant and contracts
    const getApplicantContact = await getContactByContactCode(contactCode)
    if (!getApplicantContact.ok) {
      return endFailingProcess(
        log,
        CreateNoteOfInterestErrorCodes.ApplicantNotFound,
        404,
        `Applicant ${contactCode} could not be retrieved.`
      )
    }

    const applicantContact = getApplicantContact.data

    //step 3a. Check if applicant is tenant
    const leases = await getLeasesForContactCode(contactCode, {
      includeUpcomingLeases: true,
      includeTerminatedLeases: false,
      includeContacts: false,
    })

    if (leases.length < 1) {
      return endFailingProcess(
        log,
        CreateNoteOfInterestErrorCodes.ApplicantNotTenant,
        403,
        `Applicant ${contactCode} is not a tenant`
      )
    }
    //Check if applicant is eligible for renting in area with specific rental rule
    const [validationResultResArea, validationResultProperty] =
      await Promise.all([
        validateResidentialAreaRentalRules(
          contactCode,
          parkingSpace.rentalObject.residentialAreaCode
        ),
        validatePropertyRentalRules(contactCode, parkingSpaceId),
      ]).then((results) =>
        results.map((res) => validateRentalRules(res, applicationType))
      )

    if (!validationResultResArea.ok) {
      return endFailingProcess(
        log,
        validationResultResArea.err ??
          CreateNoteOfInterestErrorCodes.NotEligibleToRent,
        400,
        `Applicant ${contactCode} is not eligible for renting due to Residential Area Rental Rules`
      )
    }
    if (!validationResultProperty.ok) {
      return endFailingProcess(
        log,
        validationResultProperty.err ??
          CreateNoteOfInterestErrorCodes.NotEligibleToRent,
        400,
        `Applicant ${contactCode} is not eligible for renting due to Property Rental Rules`
      )
    }

    //step 3.a.1. Perform credit check
    const debtCollectionInvoices = await getInvoicesSentToDebtCollection(
      applicantContact.contactCode
    )
    if (!debtCollectionInvoices.ok) {
      return endFailingProcess(
        log,
        CreateNoteOfInterestErrorCodes.InternalError,
        500,
        `Failed to get invoices for contact ${applicantContact.contactCode}: ${debtCollectionInvoices.statusCode} ${debtCollectionInvoices.err}`
      )
    }
    const creditCheck = debtCollectionInvoices.data.length === 0

    log.push(
      `Intern kreditkontroll genomförd, resultat: ${
        creditCheck ? 'inga anmärkningar' : 'hyresfakturor hos inkasso'
      }`
    )

    if (!creditCheck) {
      log.push(
        `Ansökan kunde inte beviljas på grund av ouppfyllda kreditkrav (se ovan).`
      )
      logger.debug(log)
      sendNotificationToRole(
        'leasing',
        'Skapa intresseanmälan - Ouppfyllda kreditkrav',
        log.join('\n')
      )

      return makeProcessError(
        CreateNoteOfInterestErrorCodes.InternalCreditCheckFailed,
        400,
        {
          message: 'The parking space lease application has been rejected',
        }
      )
    }
    //step 3.b Check if applicant is in queue for parking spaces, if not add to queue
    if (!applicantContact.parkingSpaceWaitingList) {
      log.push(`Sökande saknas i kö för parkeringsplats.`)
      const result = await addApplicantToWaitingList(
        applicantContact.contactCode,
        WaitingListType.ParkingSpace
      )
      if (result.status == HttpStatusCode.Created) {
        log.push(`Sökande placerad i kö för parkeringsplats`)
      } else {
        logger.error(
          result,
          `Could not add applicant to parking space waiting list`
        )

        throw Error(result.statusText)
      }
    }

    log.push(
      `Validering genomförd. Sökande godkänd för att anmäla intresse på bilplats ${parkingSpaceId}`
    )

    //step 4.b Add parking space listing to onecore-leases database
    //todo: refactor get and create listing to new func ->
    //todo: should return the listing regardless of if it exists previously or is being created
    let listingAdapterResult =
      await getActiveListingByRentalObjectCode(parkingSpaceId)
    if (listingAdapterResult?.ok) {
      log.push(
        `Annons med id ${listingAdapterResult.data?.id} existerar sedan tidigare i onecore-leasing`
      )
    }

    if (!listingAdapterResult.ok && listingAdapterResult?.err == 'not-found') {
      log.push(`Annons existerar inte i onecore-leasing, skapar annons`)
      const createListingResult = await createNewListing(parkingSpace)
      if (createListingResult.ok) {
        log.push(`Annons skapad i onecore-leasing`)
        listingAdapterResult = createListingResult
      } else {
        return endFailingProcess(
          log,
          CreateNoteOfInterestErrorCodes.InternalError,
          500,
          `Listing could not be created`
        )
      }
    }

    //step 4.c Add applicant to onecore-leasing database
    //todo: fix schema for listingId in leasing, null should not be allowed
    //todo: or add a request type with only required fields
    if (listingAdapterResult.ok && listingAdapterResult?.data != undefined) {
      const applicantResponse = await getApplicantByContactCodeAndListingId(
        contactCode,
        listingAdapterResult.data.id.toString()
      )

      //create new applicant if applicant does not exist
      if (applicantResponse.status == HttpStatusCode.NotFound) {
        const applicantRequestBody = createApplicantRequestBody(
          applicantContact,
          applicationType,
          listingAdapterResult.data
        )

        log.push(`Sökande existerar inte, skapar sökande.`)

        const applyForListingResult =
          await applyForListing(applicantRequestBody)
        if (applyForListingResult.ok) {
          log.push(`Sökande skapad i onecore-leasing. Process avslutad.`)
          logger.debug(log)
          return {
            processStatus: ProcessStatus.successful,
            data: null,
            httpStatus: 200,
            response: {
              message: `Applicant ${contactCode} successfully applied to parking space ${parkingSpaceId}`,
            },
          }
        }
        if (applyForListingResult.err == 'conflict') {
          log.push(
            `Sökande existerar redan i onecore-leasing. Process avslutad`
          )
          logger.debug(log)
          return {
            processStatus: ProcessStatus.successful,
            data: null,
            httpStatus: 200,
            response: {
              message: `Applicant ${contactCode} already has application for ${parkingSpaceId}`,
            },
          }
        } else {
          return endFailingProcess(
            log,
            CreateNoteOfInterestErrorCodes.InternalError,
            500,
            `Application could not be created`
          )
        }
      }

      //if applicant has previously applied and withdrawn application, allow for subsequent application
      else if (applicantResponse.data.content) {
        const applicantStatus = applicantResponse.data.content.status
        const activeApplication = applicantStatus == ApplicantStatus.Active
        const applicationWithDrawnByUser =
          applicantStatus == ApplicantStatus.WithdrawnByUser
        const applicationWithDrawnByManager =
          applicantStatus == ApplicantStatus.WithdrawnByManager

        if (activeApplication) {
          log.push(
            `Sökande har redan en aktiv ansökan på bilplats ${parkingSpaceId}.`
          )
          logger.debug(log)
          return {
            processStatus: ProcessStatus.successful,
            data: null,
            httpStatus: 200,
            response: {
              message: `Applicant ${contactCode} already has application for ${parkingSpaceId}`,
            },
          }
        }

        if (applicationWithDrawnByUser || applicationWithDrawnByManager) {
          log.push(
            `Sökande har tidigare ansökt bilplats ${parkingSpaceId} men återkallat sin ansökan. Skapar ny ansökan.`
          )

          await setApplicantStatusActive(
            applicantResponse.data.content.id,
            applicantResponse.data.content.contactCode,
            applicationType
          )

          logger.debug(log)
          return {
            processStatus: ProcessStatus.successful,
            data: null,
            httpStatus: 200,
            response: {
              message: `Applicant ${contactCode} successfully applied to parking space ${parkingSpaceId}`,
            },
          }
        }
      }
    }

    return endFailingProcess(
      log,
      CreateNoteOfInterestErrorCodes.InternalError,
      500,
      'Create note of interest for internal parking space failed due to unknown error 1'
    )
  } catch (error: any) {
    const errorMessage =
      error instanceof Error
        ? 'Create note of interest for internal parking space failed: ' +
          error.message
        : 'Create note of interest for internal parking space failed: ' + error

    return endFailingProcess(
      log,
      CreateNoteOfInterestErrorCodes.InternalError,
      500,
      errorMessage,
      error
    )
  }
}

// Ends a process gracefully by debugging log, logging the error, sending the error to the dev team and return a process error with the error code and details
const endFailingProcess = (
  log: any[],
  processErrorCode: string,
  httpStatus: number,
  details: string,
  error?: any
): ProcessError => {
  log.push(details)
  if (error) log.push(error)

  logger.debug(log)
  logger.error(error ?? processErrorCode, details)

  sendNotificationToRole(
    'dev',
    `Create Note of Interest - ${processErrorCode}`,
    log.join('\n')
  )

  return makeProcessError(processErrorCode, httpStatus, { message: details })
}

const createApplicantRequestBody = (
  applicantContact: Contact,
  applicationType: string,
  listing: Listing
) => {
  const applicantRequestBody: Applicant = {
    id: 0, //should not be passed
    name: applicantContact.fullName,
    nationalRegistrationNumber: applicantContact.nationalRegistrationNumber,
    contactCode: applicantContact.contactCode,
    applicationDate: new Date(),
    applicationType: applicationType,
    status: ApplicantStatus.Active,
    listingId: listing.id, //null should not be allowed
  }
  return applicantRequestBody
}
