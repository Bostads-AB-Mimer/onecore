import { getPublishedParkingSpace } from '../../../adapters/property-management-adapter'
import { ProcessResult, ProcessStatus } from '../../../common/types'
import {
  addApplicantToWaitingList,
  applyForListing,
  createNewListing,
  getContact,
  getLeasesForPnr,
  getListingByRentalObjectCode,
  getWaitingList,
} from '../../../adapters/leasing-adapter'
import {
  Applicant,
  ListingStatus,
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
} from 'onecore-types'
import axios, { AxiosError, HttpStatusCode } from 'axios'
import * as http from 'http'

//
// PROCESS part 1 (Create note of interest for internal parking space)
//
// Description: Applicant adds note of interest to parking space marked as internal, automatic check is performed at due date/time of ad, contract is created in Xpand when "most" fitting applicant accepts offer
// Steps:
// 1.  Get parking space from SOAP-service or xpand database (best buck for bang approach to be investigated)
// 2.  Get applicant from onecore-leasing
// 3.a Check that applicant is a tenant
// 3.b Check if applicant is in queue for parking spaces, if not add to queue. Use SOAP-service
// 4.a Pass parking space ad and applicant data to onecore-leasing for further processing. onoecore-leasing has tables for keeping track of ads and applicants.
// 4.b onecore-leasing adds the parking space to internal db if not already existing.
// 4.c onecore-leasing adds applicants to the list of applicants for this particular ad

export const createNoteOfInterestForInternalParkingSpace = async (
  parkingSpaceId: string,
  contactCode: string,
  applicationType: string
): Promise<ProcessResult> => {
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
    if (!parkingSpace) {
      return {
        processStatus: ProcessStatus.failed,
        httpStatus: 404,
        response: {
          message: `The parking space ${parkingSpaceId} does not exist or is no longer available.`,
        },
      }
    }

    const parkingSpaceApplicationType = parkingSpace.waitingListType
      ? parkingSpaceApplicationCategoryTranslation[parkingSpace.waitingListType]
      : undefined

    if (
      parkingSpaceApplicationType != ParkingSpaceApplicationCategory.internal
    ) {
      return {
        processStatus: ProcessStatus.failed,
        httpStatus: 400,
        response: {
          message: `This process currently only handles internal parking spaces. The parking space provided is not internal (it is ${parkingSpace.applicationCategory}, ${parkingSpaceApplicationCategoryTranslation.internal}).`,
        },
      }
    }

    // Step 2. Get information about applicant and contracts
    const applicantContact = await getContact(contactCode)
    if (!applicantContact) {
      return {
        processStatus: ProcessStatus.failed,
        httpStatus: 404,
        response: {
          message: `Applicant ${contactCode} could not be retrieved.`,
        },
      }
    }
    //step 3a. Check if applicant is tenant
    const leases = await getLeasesForPnr(
      applicantContact.nationalRegistrationNumber
    )
    if (leases.length < 1) {
      return {
        processStatus: ProcessStatus.failed,
        httpStatus: 403,
        response: {
          message: 'Applicant is not a tenant',
        },
      }
    }

    //step 3.b Check if applicant is in queue for parking spaces, if not add to queue
    const waitingList = await getWaitingList(
      applicantContact.nationalRegistrationNumber
    )

    let shouldAddApplicantToWaitingList = false
    let isInWaitingListForInternalParking = false
    let isInWaitingListForExternalParking = false
    if (waitingList.length > 0) {
      isInWaitingListForInternalParking = waitingList.some(
        (o) => o.waitingListTypeCaption === 'Bilplats (intern)'
      )
      isInWaitingListForExternalParking = waitingList.some(
        (o) => o.waitingListTypeCaption === 'Bilplats (extern)'
      )
      if (
        !isInWaitingListForInternalParking ||
        !isInWaitingListForExternalParking
      ) {
        shouldAddApplicantToWaitingList = true
      }
    } else {
      shouldAddApplicantToWaitingList = true
    }
    //xpand handles internal and external waiting list synonymously
    //a user should therefore always be placed in both waiting list
    if (shouldAddApplicantToWaitingList) {
      if (!isInWaitingListForInternalParking) {
        log.push(`Sökande saknas i kö för intern parkeringsplats.`)
        const result = await addApplicantToWaitingList(
          applicantContact.nationalRegistrationNumber,
          applicantContact.contactCode,
          'Bilplats (intern)'
        )
        if (result.status == HttpStatusCode.Created) {
          log.push(`Sökande placerad i kö för intern parkeringsplats`)
        } else {
          throw Error(result.statusText)
        }
      }
      if (!isInWaitingListForExternalParking) {
        log.push(`Sökande saknas i kö för extern parkeringsplats.`)
        const result = await addApplicantToWaitingList(
          applicantContact.nationalRegistrationNumber,
          applicantContact.contactCode,
          'Bilplats (extern)'
        )
        if (result.status == HttpStatusCode.Created) {
          log.push(`Sökande placerad i kö för extern parkeringsplats`)
        } else {
          throw Error(result.statusText)
        }
      }
    }

    log.push(
      `Validering genomförd. Sökande godkänd för att anmäla intresse på bilplats ${parkingSpaceId}`
    )

    //step 4.b Add parking space listing to onecore-leases database
    let listing = await getListingByRentalObjectCode(parkingSpaceId)
    if (listing?.status == HttpStatusCode.Ok) {
      log.push(
        `Annons med id ${listing?.data.id} existerar sedan tidigare i onecore-leasing`
      )
    }

    if (listing?.status == HttpStatusCode.NotFound) {
      log.push(`Annons existerar inte i onecore-leasing, skapar annons`)
      const createListingResult = await createNewListing(parkingSpace)
      if (createListingResult?.status == HttpStatusCode.Created) {
        log.push(`Annons skapad i onecore-leasing`)
        listing = createListingResult
      }
    }

    //step 4.c Add applicant to onecore-leasing database
    //todo: fix schema for listingId in leasing, null should not be allowed
    //todo: or add a request type with only required fields
    if (listing?.data != undefined) {
      const applicant: Applicant = {
        id: 0, //should not be passed
        name: applicantContact.fullName,
        contactCode: applicantContact.contactCode,
        applicationDate: new Date(),
        applicationType: applicationType,
        status: ListingStatus.Active,
        listingId: listing.data?.id, //null should not be allowed
      }

      const applyForListingResult = await applyForListing(applicant)

      if (applyForListingResult?.status == HttpStatusCode.Created) {
        log.push(`Sökande skapad i onecore-leasing. Process avslutad.`)
        console.log(log)
        return {
          processStatus: ProcessStatus.successful,
          httpStatus: 200,
          response: {
            message: `Applicant ${contactCode} successfully applied to parking space ${parkingSpaceId}`,
          },
        }
      }
      if (applyForListingResult?.status == HttpStatusCode.Conflict) {
        log.push(`Sökande existerar redan i onecore-leasing. Process avslutad`)
        console.log(log)
        return {
          processStatus: ProcessStatus.inProgress,
          httpStatus: 200, //return other status
          response: {
            message: 'Applicant already exists in listing',
          },
        }
      }
    }

    return {
      processStatus: ProcessStatus.failed,
      httpStatus: 500,
      response: {
        message: 'failed due to unknown error',
      },
    }
  } catch (error: any) {
    return {
      processStatus: ProcessStatus.failed,
      httpStatus: 500,
      response: {
        message: error.message,
      },
    }
  }
}

//
// PROCESS part 2 (Scheduled job removes ad on due date/time, applicants sorted, create contract, publish as external if not applicants )
//
// 1. Scheduled job checks for due date of ad. The ad is "unpublished" on due date, E.G. not possible to apply anymore.
// 2. The list of applicants is sorted on queue time and other business rules.
// 3. Offer flow for the "best" suited applicant is triggered
// 4. Applicant is notified by mail that they have an offer to accept
// 5. If applicant accepts offer, contract is created and sent via email. the other applicants are notified that the parking space has been rented.
// 6. If offer is declined, the user is removed from list of applicants, process starts over from step 6
// 7. If no applicants are found, the ad is published as an external parking space
export const createLeaseForInternalParkingSpace =
  async (): Promise<ProcessResult> => {
    return {
      processStatus: ProcessStatus.inProgress,
      httpStatus: 500,
      response: {
        message: 'todo',
      },
    }
  }
