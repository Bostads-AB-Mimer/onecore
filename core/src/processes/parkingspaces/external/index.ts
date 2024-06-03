import {
  sendNotificationToContact,
  sendNotificationToRole,
} from '../../../adapters/communication-adapter'
import { getParkingSpace } from '../../../adapters/property-management-adapter'
import { ProcessResult, ProcessStatus } from '../../../common/types'
import {
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
} from 'onecore-types'
import {
  createLease,
  getContact,
  getCreditInformation,
  getInternalCreditInformation,
} from '../../../adapters/leasing-adapter'

//
// PROCESS (Create lease for external parking space)
//
// Description: Applicant books parking space marked as external, automatic check is performed, contract is created in Xpand
// Steps:
// 1. Get parking space from mimer.nu API
// 2. Get applicant from onecore-leasing
// 3a. If applicant has no contracts, perform external credit check in onecore-leasing
// 3b. If applicant has contracts, perform internal credit check by fetching payment history from onecore-leasing
// 4. If credit check is approved, create contract by calling Xpand soap service
// 5a. If contract is created successfully, notify applicant and role uthyrning using onecore-communication
// 5b. If contract could not be created, notify applicant and role uthyrning using onecore-communication
// 6. If credit check is rejected, notify applicant and role uthyrning using onecore-communication
// 7. If a technical error occurs, return error code.
//
export const createLeaseForExternalParkingSpace = async (
  parkingSpaceId: string,
  contactId: string,
  startDate: string | undefined
): Promise<ProcessResult<unknown, unknown>> => {
  const log: string[] = [
    `Ansökan om extern bilplats`,
    `Tidpunkt för ansökan: ${new Date()
      .toISOString()
      .substring(0, 16)
      .replace('T', ' ')}`,
    `Sökande ${contactId} har ansökt om bilplats ${parkingSpaceId}`,
  ]

  try {
    const parkingSpace = await getParkingSpace(parkingSpaceId)

    if (!parkingSpace) {
      return {
        processStatus: ProcessStatus.failed,
        error: 'parking-space-not-found',
        httpStatus: 404,
        response: {
          message: `The parking space ${parkingSpaceId} does not exist or is no longer available.`,
        },
      }
    }

    if (
      parkingSpace.applicationCategory !=
      ParkingSpaceApplicationCategory.external
    ) {
      return {
        processStatus: ProcessStatus.failed,
        error: 'parkingspace-not-external',
        httpStatus: 404,
        response: {
          message: `This process currently only handles external parking spaces. The parking space provided is not external (it is ${parkingSpace.applicationCategory}, ${parkingSpaceApplicationCategoryTranslation.external}).`,
        },
      }
    }

    // Step 2. Get information about applicant and contracts
    const applicantContact = await getContact(contactId)

    if (!applicantContact) {
      return {
        processStatus: ProcessStatus.failed,
        error: 'applicant-not-found',
        httpStatus: 404,
        response: {
          message: `Applicant ${contactId} could not be retrieved.`,
        },
      }
    }

    let creditCheck = false
    const applicantHasNoLease =
      !applicantContact.leaseIds || applicantContact.leaseIds.length == 0

    if (applicantHasNoLease) {
      const creditInformation = await getCreditInformation(
        applicantContact.nationalRegistrationNumber
      )
      creditCheck = creditInformation.status === '1'
      log.push(
        `Extern kreditupplysning genomförd. Resultat: ${
          creditInformation.status_text
        } ${creditInformation.errorList?.[0]?.Reject_text ?? ''}`
      )
    } else {
      creditCheck = await getInternalCreditInformation(
        applicantContact.contactCode
      )

      log.push(
        `Intern kreditkontroll genomförd, resultat: ${
          creditCheck ? 'inga anmärkningar' : 'hyresfakturor hos inkasso'
        }`
      )
    }

    if (creditCheck) {
      // Step 4A. Create lease
      const lease = await createLease(
        parkingSpace.parkingSpaceId,
        applicantContact.contactCode,
        startDate != undefined ? startDate : new Date().toISOString(),
        '001'
      )

      log.push(`Kontrakt skapat: ${lease.LeaseId}`)

      log.push(
        'Kontrollera om moms ska läggas på kontraktet. Detta måste göras manuellt innan det skickas för påskrift.'
      )

      await sendNotificationToContact(
        applicantContact,
        'Godkänd ansökan om extern bilplats',
        `Din ansökan om bilplats har godkänts. Du kommer inom kort få ett kontrakt att skriva under digitalt.\nKontraktet har nummer ${lease.LeaseId} om du behöver referera till det i kontakt med kundcenter.\n\n**Din första faktura för din bilplats kan du se på Mina sidor. Logga in och klicka på Mina fakturor så ser du sista betalningsdag. Glöm inte att betala den i tid för att undvika förseningsavgifter.**\n\n**Eventuella nycklar hämtar du på Mimers kundcenter på Gasverksgatan 7 efter klockan 12 dagen då ditt hyreskontrakt börjar gälla. Om den dagen inträffar på en lördag, söndag eller en helgdag är du välkommen att hämta nycklarna efter klockan 12 den första vardagen därefter.**\n\nMed vänlig hälsning,\nBostads Mimer AB`
      )
      await sendNotificationToRole(
        'leasing',
        'Godkänd ansökan om extern bilplats',
        log.join('\n')
      )

      return {
        processStatus: ProcessStatus.successful,
        data: { lease },
        response: {
          lease,
          message: 'Parking space lease created.',
        },
        httpStatus: 200,
      }
    } else {
      log.push(
        `Ansökan kunde inte beviljas på grund av ouppfyllda kreditkrav (se ovan).`
      )

      await sendNotificationToContact(
        applicantContact,
        'Nekad ansökan om extern bilplats',
        'Din ansökan om bilplats kunde tyvärr inte godkännas på grund av ouppfyllda kreditkrav.\n\nOm du har frågor kring din ansökan, kontakta Mimers kundcenter. Du hittar kontaktuppgifter på https://www.mimer.nu/kontakta-oss/.\n\nMed vänlig hälsning,\nBostads Mimer AB'
      )
      await sendNotificationToRole(
        'leasing',
        'Nekad ansökan om extern bilplats',
        log.join('\n')
      )

      return {
        processStatus: ProcessStatus.failed,
        error: 'rejected-application',
        httpStatus: 400,
        response: {
          reason: applicantHasNoLease
            ? 'External check failed'
            : 'Internal check failed',
          message: 'The parking space lease application has been rejected',
        },
      }
    }
  } catch (error: any) {
    console.error('External parking space uncaught error', error)
    return {
      processStatus: ProcessStatus.failed,
      error: 'internal-error',
      httpStatus: 500,
      response: {
        message: error.message,
      },
    }
  }
}
