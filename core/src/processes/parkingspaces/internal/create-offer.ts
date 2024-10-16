import {
  ApplicantStatus,
  CreateOfferApplicantParams,
  CreateOfferErrorCodes,
  DetailedApplicant,
  LeaseStatus,
  ListingStatus,
  OfferStatus,
} from 'onecore-types'
import { logger } from 'onecore-utilities'

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

type CreateOfferError =
  | CreateOfferErrorCodes.NoListing
  | CreateOfferErrorCodes.ListingNotExpired
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
    const listing = await leasingAdapter.getListingByListingId(listingId)
    if (!listing) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.NoListing,
        500,
        `Listing with id ${listingId} not found`
      )
    }
    if (listing.status !== ListingStatus.Expired) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.ListingNotExpired,
        500,
        `Listing with id ${listingId} not expired`
      )
    }

    const eligibleApplicants = await leasingAdapter
      .getListingByIdWithDetailedApplicants(String(listing.id))
      .then((applicants) => {
        // filter out any applicants that has no priority. They are not eligible to rent the object of this listing
        return applicants?.filter(
          (
            detailedApplicant
          ): detailedApplicant is DetailedApplicant & { priority: number } => {
            return (
              detailedApplicant.priority != undefined &&
              detailedApplicant.status === ApplicantStatus.Active
            )
          }
        )
      })

    if (!eligibleApplicants?.length) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.NoApplicants,
        500,
        `No eligible applicants found, cannot create new offer`
      )
    }

    const [applicant, ...restApplicants] = eligibleApplicants

    // TODO: Maybe we want to make a credit check here?

    const getContact = await leasingAdapter.getContact(applicant.contactCode)
    if (!getContact.ok) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.NoContact,
        500,
        `Could not find contact ${applicant.contactCode}`
      )
    }

    const contact = getContact.data

    try {
      // TODO: Maybe this should happen in leasing so we dont get inconsintent
      // state if offer creation fails?
      await leasingAdapter.updateApplicantStatus({
        applicantId: applicant.id,
        contactCode: applicant.contactCode,
        status: ApplicantStatus.Offered,
      })
      log.push(`Updated status for applicant ${applicant.id}`)
    } catch (_err) {
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.UpdateApplicantStatusFailure,
        500,
        `Update Applicant Status failed`,
        _err
      )
    }

    const updatedApplicant: DetailedApplicant & { priority: number } = {
      ...applicant,
      status: ApplicantStatus.Offered,
    }
    const offer = await leasingAdapter.createOffer({
      applicantId: applicant.id,
      expiresAt: utils.date.addBusinessDays(new Date(), 2),
      listingId: listing.id,
      status: OfferStatus.Active,
      selectedApplicants: [updatedApplicant, ...restApplicants].map(
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
        subject: 'Erbjudande om intern bilplats',
        text: 'Erbjudande om intern bilplats',
        address: listing.address,
        firstName: applicant.name,
        availableFrom: new Date(listing.vacantFrom).toISOString(),
        deadlineDate: new Date(offer.data.expiresAt).toISOString(),
        rent: String(listing.monthlyRent),
        type: listing.rentalObjectTypeCaption ?? '',
        parkingSpaceId: listing.rentalObjectCode,
        objectId: listing.id.toString(),
        hasParkingSpace: false,
      })
    } catch (_err) {
      sendNotificationToRole(
        'leasing',
        `Skapa erbjudande - skicka bekräftelse till kund misslyckades - ${_err}`,
        log.join('\n')
      )
      return endFailingProcess(
        log,
        CreateOfferErrorCodes.SendEmailFailure,
        500,
        `Send Parking Space Offer Email failed`,
        _err
      )
    }
    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 200,
      data: null,
    }

    // step 5 - notify winning applicant
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
  a: DetailedApplicant & { priority: number }
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
    hasParkingSpace: Boolean(a.parkingSpaceContracts?.length),
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
