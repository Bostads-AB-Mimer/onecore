import axios from 'axios'
jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
      debug: () => {
        return
      },
    },
    loggedAxios: axios,
    axiosTypes: axios,
  }
})

import { ListingStatus } from 'onecore-types'

import { createOfferForInternalParkingSpace } from '../create-offer'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as factory from '../../../../../test/factories'
import { ProcessStatus } from '../../../../common/types'

describe('createOfferForInternalParkingSpace', () => {
  it('fails if there is no listing', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(undefined)

    const result = await createOfferForInternalParkingSpace('123')

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

    const result = await createOfferForInternalParkingSpace('123')

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

    const result = await createOfferForInternalParkingSpace('123')

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: 'no-applicants',
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
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockRejectedValueOnce(null)

    const result = await createOfferForInternalParkingSpace('123')

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
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest.spyOn(leasingAdapter, 'createOffer').mockRejectedValueOnce(null)

    const result = await createOfferForInternalParkingSpace('123')

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
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce(factory.offer.build())

    const result = await createOfferForInternalParkingSpace('123')

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })
  })
})
