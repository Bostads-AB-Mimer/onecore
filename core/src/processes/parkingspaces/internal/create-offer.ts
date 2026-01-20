import {
  ApplicantStatus,
  CreateOfferApplicantParams,
  CreateOfferErrorCodes,
  DetailedApplicant,
  LeaseStatus,
  ListingStatus,
  OfferStatus,
} from '@onecore/types'
import { logger } from '@onecore/utilities'

import {
  ProcessResult,
  ProcessStatus,
  ProcessError,
} from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as utils from '../../../utils'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import { makeProcessError } from '../utils'
import { sendNotificationToRole } from '../../../adapters/communication-adapter'
import config from '../../../common/config'
import { calculateVacantFrom } from '../../../common/helpers'

type CreateOfferError =
  | CreateOfferErrorCodes.NoListing
  | CreateOfferErrorCodes.ListingNotExpired
  | CreateOfferErrorCodes.RentalObjectNotVacant
  | CreateOfferErrorCodes.NoApplicants
  | CreateOfferErrorCodes.CreateOfferFailure
  | CreateOfferErrorCodes.UpdateApplicantStatusFailure
  | CreateOfferErrorCodes.NoContact
  | CreateOfferErrorCodes.SendEmailFailure
  | CreateOfferErrorCodes.Unknown

// PROCESS Part 2 - Create Offer for Scored Parking Space
export const createOfferForInternalParkingSpace = async (
  listingId: number
): Promise<ProcessResult<null, CreateOfferError>> => {
  const log: string[] = [
    `Skapa erbjudande för intern bilplats`,
    `Tidpunkt: ${new Date().toISOString().substring(0, 16).replace('T', ' ')}`,
    `Erbjudande ska skapas för annons-ID ${listingId}`,
  ]

  try {
    const listingWithoutRentalObject =
      await leasingAdapter.getListingByListingId(listingId)
    if (!listingWithoutRentalObject) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.NoListing,
        500,
        `Listing with id ${listingId} not found`
      )
    }

    const parkingSpacesResult = await leasingAdapter.getParkingSpaceByCode(
      listingWithoutRentalObject.rentalObjectCode
    )

    if (!parkingSpacesResult.ok) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.NoListing,
        500,
        `RentalObject for listing with id ${listingId} not found`
      )
    }

    const listing = {
      ...listingWithoutRentalObject,
      rentalObject: parkingSpacesResult.data,
    }

    if (listing.status !== ListingStatus.Expired) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.ListingNotExpired,
        500,
        `Listing with id ${listingId} not expired`
      )
    }

    if (!listing.rentalObject.vacantFrom) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.RentalObjectNotVacant,
        500,
        `Listing with id ${listingId} has no vacantFrom date`
      )
    }

    const allApplicants =
      await leasingAdapter.getDetailedApplicantsByListingId(listingId)

    if (!allApplicants.ok) {
      throw new Error('Could not get applicants')
    }

    const eligibleApplicant = await getFirstEligibleApplicant(
      allApplicants.data
    )

    // discard the first applicant since that is our eligibleApplicant
    // leasing currently guarantees that the list is sorted correctly
    const [_first, ...activeApplicants] = await getActiveApplicants(
      allApplicants.data
    )

    if (!eligibleApplicant) {
      const updateListingStatus = await leasingAdapter.updateListingStatus(
        listing.id,
        ListingStatus.Closed
      )

      if (!updateListingStatus.ok) {
        return endFailingProcess(
          log,
          CreateOfferErrorCodes.UpdateListingStatusFailure,
          500,
          `Error updating listing status to Closed.`
        )
      }

      logger.info(
        { listingId: listing.id },
        'No eligible applicant found, no offer created.'
      )
      return makeProcessError(CreateOfferErrorCodes.NoApplicants, 500, {
        message: 'No eligible applicant found, no offer created.',
      })
    }

    const getContact = await leasingAdapter.getContactByContactCode(
      eligibleApplicant.contactCode
    )
    if (!getContact.ok) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.NoContact,
        500,
        `Could not find contact ${eligibleApplicant.contactCode}`
      )
    }

    const contact = getContact.data

    try {
      // TODO: Maybe this should happen in leasing so we dont get inconsintent
      // state if offer creation fails?
      await leasingAdapter.updateApplicantStatus({
        applicantId: eligibleApplicant.id,
        contactCode: eligibleApplicant.contactCode,
        status: ApplicantStatus.Offered,
      })
      log.push(`Updated status for applicant ${eligibleApplicant.id}`)
    } catch (_err) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.UpdateApplicantStatusFailure,
        500,
        `Update Applicant Status failed`,
        _err
      )
    }

    const updatedApplicant: DetailedApplicant = {
      ...eligibleApplicant,
      status: ApplicantStatus.Offered,
    }

    const offerExpiresDate = utils.date.addBusinessDays(new Date(), 3)
    // Set swedish time (CET/CEST) 23:59:59
    offerExpiresDate.setHours(23, 59, 59, 0)
    // Convert to UTC time
    const utcOfferExpiresDate = new Date(
      offerExpiresDate.getTime() - offerExpiresDate.getTimezoneOffset() * 60000
    )

    const offer = await leasingAdapter.createOffer({
      applicantId: eligibleApplicant.id,
      expiresAt: utcOfferExpiresDate,
      listingId: listing.id,
      status: OfferStatus.Active,
      selectedApplicants: [updatedApplicant, ...activeApplicants].map(
        mapDetailedApplicantsToCreateOfferSelectedApplicants
      ),
    })

    if (!offer.ok) {
      sendNotificationToRole(
        'leasing',
        `Skapa erbjudande misslyckades - ${offer.err}`,
        log.join('\n')
      )
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.CreateOfferFailure,
        500,
        `Create Offer failed`
      )
    }

    log.push(`Created offer ${offer.data.id}`)

    try {
      if (!contact.emailAddress)
        throw new Error('Recipient has no email address')

      await communicationAdapter.sendParkingSpaceOfferEmail({
        to: contact.emailAddress,
        subject: 'Erbjudande om bilplats',
        text: 'Erbjudande om bilplats',
        address: listing.rentalObject.address,
        firstName: eligibleApplicant.name
          ? extractApplicantFirstName(eligibleApplicant.name)
          : '',
        availableFrom: calculateVacantFrom(listing).toISOString(),
        deadlineDate: new Date(offer.data.expiresAt).toISOString(),
        rent: String(listing.rentalObject.rent?.amount ?? ''),
        type: listing.rentalObject.objectTypeCaption ?? '',
        parkingSpaceId: listing.rentalObjectCode,
        objectId: listing.id.toString(),
        applicationType:
          eligibleApplicant.applicationType &&
          eligibleApplicant.applicationType === 'Replace'
            ? 'Replace'
            : 'Additional',
        offerURL: constructOfferURL(offer.data.id),
      })
      const updateOfferSentAt = await leasingAdapter.updateOfferSentAt(
        offer.data.id,
        new Date()
      )

      if (updateOfferSentAt.ok) {
        log.push(`Updated sent at for offer ${offer.data.id}`)
      } else {
        sendNotificationToRole(
          'dev',
          `Uppdatera erbjudande - uppdatera SentAt misslyckades - ${updateOfferSentAt.err}`,
          log.join('\n')
        )
      }
    } catch (err) {
      sendNotificationToRole(
        'leasing',
        `Skapa erbjudande - skicka bekräftelse till kund misslyckades - ${err}`,
        log.join('\n')
      )
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.SendEmailFailure,
        500,
        `Send Parking Space Offer Email failed`,
        err
      )
    }
    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 200,
      data: null,
    }
  } catch (err) {
    return endFailingProcess(
      log,
      CreateOfferErrorCodes.Unknown,
      500,
      `Create Offer failed - unknown error`,
      err
    )
  }
}

async function getActiveApplicants(applicants: DetailedApplicant[]) {
  //filter out applicants that are not active and include applicants without priority
  return applicants.filter((a): a is DetailedApplicant => {
    return a.status === ApplicantStatus.Active
  })
}

async function getFirstEligibleApplicant(applicants: DetailedApplicant[]) {
  // Find the first applicant who has a priority and is active
  return applicants.find((a): a is DetailedApplicant => {
    return a.priority !== null && a.status === ApplicantStatus.Active
  })
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
    `Create Offer - ${processErrorCode}`,
    log.join('\n')
  )

  return makeProcessError(processErrorCode, httpStatus, { message: details })
}

function mapDetailedApplicantsToCreateOfferSelectedApplicants(
  a: DetailedApplicant
): CreateOfferApplicantParams {
  return {
    listingId: a.listingId,
    applicantId: a.id,
    priority: a.priority,
    status: a.status,
    address: a.address ? `${a.address.street} ${a.address.city}` : '',
    applicationType: a.applicationType
      ? (a.applicationType as 'Replace' | 'Additional')
      : 'Additional', //TODO: Fix this
    queuePoints: a.queuePoints,
    hasParkingSpace: Boolean(
      a.parkingSpaceContracts?.filter(
        (l: any) =>
          l.status == LeaseStatus.Current || l.status == LeaseStatus.Upcoming
      ).length
    ),
    // TODO: Ended is not a good fallback here
    // because if the applicant doesnt have at least one current or upcoming
    // contract they can't apply in the first place.
    // But we don't have a good way of determining that at the moment
    housingLeaseStatus: a.upcomingHousingContract
      ? a.upcomingHousingContract.status
      : a.currentHousingContract
        ? a.currentHousingContract.status
        : LeaseStatus.Ended,
  }
}

function extractApplicantFirstName(name: string): string {
  const fullName = name.split(' ')
  return fullName[1] //return first name due to format "lastname, firstname"
}

function constructOfferURL(offerId: number): string {
  return `${config.minaSidor.url}/mina-sidor/erbjudanden/detalj?e=${offerId}&s=onecore`
}
