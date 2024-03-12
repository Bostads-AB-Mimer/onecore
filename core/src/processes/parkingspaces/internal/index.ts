import { getPublishedParkingSpace } from '../../../adapters/property-management-adapter'
import { ProcessResult, ProcessStatus } from '../../../common/types'
import {
  getContact,
  getLeasesForPnr,
} from '../../../adapters/leasing-adapter'
import {
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
} from 'onecore-types'

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
  contactId: string
): Promise<ProcessResult> => {
  const log: string[] = [
    `Ansökan om intern bilplats`,
    `Tidpunkt för ansökan: ${new Date()
      .toISOString()
      .substring(0, 16)
      .replace('T', ' ')}`,
    `Sökande ${contactId} har ansökt om bilplats ${parkingSpaceId}`,
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

    if (
      parkingSpace.applicationCategory !=
      ParkingSpaceApplicationCategory.internal
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
    const applicantContact = await getContact(contactId)
    if (!applicantContact) {
      return {
        processStatus: ProcessStatus.failed,
        httpStatus: 404,
        response: {
          message: `Applicant ${contactId} could not be retrieved.`,
        },
      }
    }
    //step 3a. Check if applicant is tenant
    const leases = await getLeasesForPnr(applicantContact.nationalRegistrationNumber)
    if(leases.length < 1){
      return {
        processStatus: ProcessStatus.failed,
        httpStatus: 403,
        response: {
          message: "Applicant is not a tenant",
        },
      }
    }

    //todo step 3.b Check if applicant is in queue for parking spaces, if not add to queue

    //todo: validation is now done, continue to pass application data to onecore-leasing
    return {
      processStatus: ProcessStatus.inProgress,
      httpStatus: 500,
      response: {
        message: "implement passing application data to onecore-leasing",
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
export const createLeaseForInternalParkingSpace = async (
): Promise<ProcessResult> => {

  return {
    processStatus: ProcessStatus.inProgress,
    httpStatus: 500,
    response: {
      message: "todo",
    },
  }
}
