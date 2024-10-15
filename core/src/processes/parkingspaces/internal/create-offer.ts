import {
  ApplicantStatus,
  CreateOfferApplicantParams,
  DetailedApplicant,
  LeaseStatus,
  ListingStatus,
  OfferStatus,
} from 'onecore-types'
import { logger } from 'onecore-utilities'

import { ProcessResult, ProcessStatus } from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as utils from '../../../utils'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import { makeProcessError } from '../utils'

type CreateOfferError =
  | 'no-listing'
  | 'listing-not-expired'
  | 'no-applicants'
  | 'create-offer'
  | 'update-applicant-status'
  | 'get-contact'
  | 'send-email'
  | 'unknown'

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
      logger.error('Listing not found')
      return makeProcessError('no-listing', 500)
    }
    if (listing.status !== ListingStatus.Expired) {
      logger.error(listing, 'Listing not expired')
      return makeProcessError('listing-not-expired', 500)
    }

    const eligibleApplicants = await leasingAdapter
      .getListingByIdWithDetailedApplicants(String(listing.id))
      .then((applicants) => {
        // filter out any applicants that has no priority. They are not eligible to rent the object of this listing
        return applicants?.filter(
          (
            detailedApplicant
          ): detailedApplicant is DetailedApplicant & { priority: number } => {
            return detailedApplicant.priority != undefined
          }
        )
      })

    const pickableApplicants = eligibleApplicants?.filter(
      (a) => a.status === ApplicantStatus.Active
    )
    if (!pickableApplicants?.length) {
      logger.error('No pickable applicants found, cannot create new offer')
      return makeProcessError('no-applicants', 500)
    }

    const [applicant, ...restApplicants] = pickableApplicants

    // TODO: Maybe we want to make a credit check here?

    const getContact = await leasingAdapter.getContact(applicant.contactCode)
    if (!getContact.ok) {
      logger.error('Could not find contact')
      return makeProcessError('get-contact', 500)
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
      logger.error(
        _err,
        'Error creating offer for internal parking space - could not update applicant status'
      )
      return makeProcessError('update-applicant-status', 500)
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
      logger.error(
        offer.err,
        'Error creating offer for internal parking space - could not create offer'
      )

      return makeProcessError('create-offer', 500)
    }

    log.push(`Created offer ${offer.data.id}`)
    console.log(log)
    logger.debug(log)

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
      logger.error(
        _err,
        'Error creating offer for internal parking space - could not send email'
      )
      return makeProcessError('send-email', 500)
    }
    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 200,
      data: null,
    }

    // step 5 - notify winning applicant
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
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
