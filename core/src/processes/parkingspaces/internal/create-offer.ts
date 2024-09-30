import { ApplicantStatus, ListingStatus, OfferStatus } from 'onecore-types'

import { ProcessResult, ProcessStatus } from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as utils from '../../../utils'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import { makeProcessError } from '../utils'
import { logger } from 'onecore-utilities'

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
        return applicants?.filter((detailedApplicant) => {
          return detailedApplicant.priority != undefined
        })
      })

    if (!eligibleApplicants?.length)
      return makeProcessError('no-applicants', 500)

    const [applicant] = eligibleApplicants

    // TODO: Maybe we want to make a credit check here?

    const getContact = await leasingAdapter.getContact(applicant.contactCode)
    if (!getContact.ok) {
      logger.error('Could not find contact')
      return makeProcessError('get-contact', 500)
    }

    const contact = getContact.data

    try {
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

    try {
      const offer = await leasingAdapter.createOffer({
        applicantId: applicant.id,
        expiresAt: utils.date.addBusinessDays(new Date(), 2),
        listingId: listing.id,
        selectedApplicants: eligibleApplicants,
        status: OfferStatus.Active,
      })
      log.push(`Created offer ${offer.id}`)
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
          deadlineDate: new Date(offer.expiresAt).toISOString(),
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
    } catch (_err) {
      logger.error(
        _err,
        'Error creating offer for internal parking space - could not create offer'
      )
      return makeProcessError('create-offer', 500)
    }

    // step 5 - notify winning applicant
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}
