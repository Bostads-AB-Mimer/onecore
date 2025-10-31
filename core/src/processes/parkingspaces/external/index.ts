import {
  sendNotificationToContact,
  sendNotificationToRole,
} from '../../../adapters/communication-adapter'
import { getParkingSpace } from '../../../adapters/property-management-adapter'
import { ProcessResult, ProcessStatus } from '../../../common/types'
import {
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
} from '@onecore/types'
import {
  createLease,
  getContactByContactCode,
  getCreditInformation,
} from '../../../adapters/leasing-adapter'
import { logger } from '@onecore/utilities'
import { getInvoicesSentToDebtCollection } from '../../../adapters/economy-adapter'

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
    const applicantResult = await getContactByContactCode(contactId)

    if (!applicantResult.ok) {
      return {
        processStatus: ProcessStatus.failed,
        error: 'applicant-not-found',
        httpStatus: 404,
        response: {
          message: `Applicant ${contactId} could not be retrieved.`,
        },
      }
    }

    const applicantContact = applicantResult.data

    // Step 2.a Check for address
    if (
      !applicantContact.address?.street ||
      !applicantContact.address?.city ||
      !applicantContact.address?.postalCode
    ) {
      return {
        processStatus: ProcessStatus.failed,
        error: 'applicant-missing-address',
        httpStatus: 404,
        response: {
          message: `Applicant ${contactId} has no address.`,
          reason: 'No address found for applicant',
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
      const debtCollectionInvoices = await getInvoicesSentToDebtCollection(
        applicantContact.contactCode
      )

      if (!debtCollectionInvoices.ok) {
        log.push(
          `Misslyckades med att skapa kontrakt för bilplats ${parkingSpace.parkingSpaceId}.`
        )
        logger.error(
          {
            err: debtCollectionInvoices.err,
            rentalObjectCode: parkingSpace.parkingSpaceId,
            contactCode: applicantContact.contactCode,
          },
          'Could not fetch invoices for applicant'
        )
        return {
          processStatus: ProcessStatus.failed,
          error: 'fetch-invoices-failed',
          httpStatus: 500,
          response: {
            message: `Could not fetch invoices for applicant.`,
          },
        }
      }

      creditCheck = debtCollectionInvoices.data.length === 0

      log.push(
        `Intern kreditkontroll genomförd, resultat: ${
          creditCheck ? 'inga anmärkningar' : 'hyresfakturor hos inkasso'
        }`
      )
    }

    if (creditCheck) {
      // Step 4A. Create lease
      const createLeaseResult = await createLease(
        parkingSpace.parkingSpaceId,
        applicantContact.contactCode,
        startDate != undefined ? startDate : new Date().toISOString(),
        '001'
      )

      if (!createLeaseResult.ok) {
        log.push(
          `Misslyckades med att skapa kontrakt för bilplats ${parkingSpace.parkingSpaceId}.`
        )
        logger.error(
          {
            err: createLeaseResult.err,
            rentalObjectCode: parkingSpace.parkingSpaceId,
            contactCode: applicantContact.contactCode,
          },
          'Lease could not be created'
        )
        return {
          processStatus: ProcessStatus.failed,
          error: 'create-lease-failed',
          httpStatus: 500,
          response: {
            message: `Lease could not be created.`,
          },
        }
      }

      const leaseId = createLeaseResult.data

      log.push(`Kontrakt skapat: ${leaseId}`)

      log.push(
        'Kontrollera om moms ska läggas på kontraktet. Detta måste göras manuellt innan det skickas för påskrift.'
      )

      await sendNotificationToContact(
        applicantContact,
        'Godkänd ansökan om bilplats',
        `Din ansökan om bilplats har godkänts!\n\nDet här händer nu:\n\n * Kontraktet: Du kommer snart få ett digitalt kontrakt att skriva under. En av våra medarbetare kommer att göra i ordning kontraktet och skicka det till dig för digital signering. Kontraktet skickas vanligtvis kommande arbetsdag men under semesterperioden kan det dröja lite längre, håll utkik i din inkorg. Kontraktsnumret är: ${leaseId}.\n\n * Faktura: Din första faktura finns på Mina sidor. Logga in och klicka på Mina fakturor för att se förfallodatum och betalningsuppgifter.\n\n * Eventuella nycklar: Om det behövs nycklar till bilplatsen så hämtar du dom på Mimers kundcenter, Gasverksgatan 7, efter kl. 12.00 den dag kontraktet börjar gälla. Om det är en helgdag, kan du hämta dem kommande vardag efter kl. 12.00.\n\nHälsningar\n\nBostads AB Mimer\n`
      )
      await sendNotificationToRole(
        'leasing',
        'Godkänd ansökan om bilplats',
        log.join('\n')
      )

      return {
        processStatus: ProcessStatus.successful,
        data: { LeaseId: leaseId },
        response: {
          leaseId,
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
    logger.error(error, 'External parking space uncaught error')
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
