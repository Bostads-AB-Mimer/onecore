import { ApplicantStatus, ListingStatus, OfferStatus } from 'onecore-types'

import { ProcessResult, ProcessStatus } from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as utils from '../../../utils'
import { makeProcessError } from '../utils'

type CreateOfferError =
  | 'no-listing'
  | 'listing-not-expired'
  | 'no-applicants'
  | 'create-offer'
  | 'update-applicant-status'
  | 'unknown'

export const createOfferForInternalParkingSpace = async (
  listingId: string
): Promise<ProcessResult<null, CreateOfferError>> => {
  const log: string[] = [
    `Skapa erbjudande för intern bilplats`,
    `Tidpunkt: ${new Date().toISOString().substring(0, 16).replace('T', ' ')}`,
    `Erbjudande ska skapas för annons-ID ${listingId}`,
  ]

  try {
    const listing = await leasingAdapter.getListingByListingId(listingId)
    if (!listing) return makeProcessError('no-listing', 500)
    if (listing.status !== ListingStatus.Expired)
      return makeProcessError('listing-not-expired', 500)

    // TODO: Maybe we want to make a credit check here?

    const applicants =
      await leasingAdapter.getListingByIdWithDetailedApplicants(
        String(listing.id)
      )

    if (!applicants?.length) return makeProcessError('no-applicants', 500)
    const [applicant] = applicants

    try {
      await leasingAdapter.updateApplicantStatus({
        applicantId: applicant.id,
        contactCode: applicant.contactCode,
        status: ApplicantStatus.Offered,
      })
      log.push(`Updated status for applicant ${applicant.id}`)
    } catch (_err) {
      return makeProcessError('update-applicant-status', 500)
    }

    try {
      const offer = await leasingAdapter.createOffer({
        applicantId: applicant.id,
        expiresAt: utils.date.addBusinessDays(new Date(), 2),
        listingId: listing.id,
        selectedApplicants: applicants,
        status: OfferStatus.Active,
      })
      log.push(`Created offer ${offer.id}`)
      console.log(log)

      return {
        processStatus: ProcessStatus.successful,
        httpStatus: 200,
        data: null,
      }
    } catch (_err) {
      return makeProcessError('create-offer', 500)
    }

    // step 5 - notify winning applicant
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}
