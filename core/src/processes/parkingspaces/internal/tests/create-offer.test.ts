import { ListingStatus } from 'onecore-types'

import { createOfferForInternalParkingSpace } from '../create-offer'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import * as factory from '../../../../../test/factories'
import { ProcessStatus } from '../../../../common/types'

describe('createOfferForInternalParkingSpace', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('fails if there is no listing', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(undefined)

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: 'no-listing',
      httpStatus: 500,
    })
  })

  it('fails if listing is not expired', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(
        factory.listing.build({ status: ListingStatus.Active })
      )

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: 'listing-not-expired',
      httpStatus: 500,
    })
  })

  it('fails if there are no applicants', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(
        factory.listing.build({ status: ListingStatus.Expired })
      )
    jest
      .spyOn(leasingAdapter, 'getListingByIdWithDetailedApplicants')
      .mockResolvedValueOnce([])

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: 'no-applicants',
      httpStatus: 500,
    })
  })

  it('passes applicants that are not eligible for renting in area with specific rental rule', async () => {
    jest.spyOn(leasingAdapter, 'getListingByListingId').mockResolvedValue(
      factory.listing.build({
        status: ListingStatus.Expired,
        districtCode: 'CEN',
      })
    )

    const applicants = [
      factory.detailedApplicant
        .params({
          id: 987,
          contactCode: '123ABC',
          priority: undefined,
        })
        .build(),
      factory.detailedApplicant
        .params({
          id: 432,
          contactCode: '456DEF',
          priority: 1,
        })
        .build(),
    ]

    jest
      .spyOn(leasingAdapter, 'getListingByIdWithDetailedApplicants')
      .mockResolvedValueOnce(applicants)
    jest
      .spyOn(leasingAdapter, 'getContact')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })

    const result = await createOfferForInternalParkingSpace(123)

    expect(leasingAdapter.updateApplicantStatus).toHaveBeenCalledWith({
      applicantId: 432,
      contactCode: '456DEF',
      status: 6,
    })

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })
  })

  it.todo(
    'passes applicants that is not eligible because of bad credit check and updates their rejection status???'
  )

  it('fails if retrieving contact information fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(
        factory.listing.build({ status: ListingStatus.Expired })
      )
    jest
      .spyOn(leasingAdapter, 'getListingByIdWithDetailedApplicants')
      .mockResolvedValueOnce(factory.detailedApplicant.buildList(1))
    jest
      .spyOn(leasingAdapter, 'getContact')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: 'get-contact',
      httpStatus: 500,
    })
  })

  it('fails if update applicant status fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(
        factory.listing.build({ status: ListingStatus.Expired })
      )
    jest
      .spyOn(leasingAdapter, 'getListingByIdWithDetailedApplicants')
      .mockResolvedValueOnce(factory.detailedApplicant.buildList(1))
    jest
      .spyOn(leasingAdapter, 'getContact')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockRejectedValueOnce(null)

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: 'update-applicant-status',
      httpStatus: 500,
    })
  })

  it('fails if create offer fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(
        factory.listing.build({ status: ListingStatus.Expired })
      )
    jest
      .spyOn(leasingAdapter, 'getListingByIdWithDetailedApplicants')
      .mockResolvedValueOnce(factory.detailedApplicant.buildList(1))
    jest
      .spyOn(leasingAdapter, 'getContact')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: 'create-offer',
      httpStatus: 500,
    })
  })

  it('creates offer', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(
        factory.listing.build({ status: ListingStatus.Expired })
      )
    jest
      .spyOn(leasingAdapter, 'getListingByIdWithDetailedApplicants')
      .mockResolvedValueOnce(factory.detailedApplicant.buildList(1))
    jest
      .spyOn(leasingAdapter, 'getContact')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)

    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce(null)

    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })
  })
})
