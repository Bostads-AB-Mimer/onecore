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

import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../../adapters/property-management-adapter'
import { ProcessStatus } from '../../../../common/types'
import { acceptOffer, denyOffer, expireOffer } from '../reply-to-offer'

import * as factory from '../../../../../test/factories'

describe('replyToOffer', () => {
  // Mock out all top level functions, such as get, put, delete and post:
  jest.mock('axios')

  const getOfferByIdSpy = jest.spyOn(leasingAdapter, 'getOfferByOfferId')
  const getPublishedParkingSpaceSpy = jest.spyOn(
    propertyManagementAdapter,
    'getPublishedParkingSpace'
  )

  beforeEach(jest.resetAllMocks)
  describe('acceptOffer', () => {
    const getOfferByIdSpy = jest.spyOn(leasingAdapter, 'getOfferByOfferId')
    const getPublishedParkingSpaceSpy = jest.spyOn(
      propertyManagementAdapter,
      'getPublishedParkingSpace'
    )
    it('returns a process error if no offer found', async () => {
      getOfferByIdSpy.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-offer',
        httpStatus: 404,
        response: {
          message: 'The offer 123 does not exist or could not be retrieved.',
        },
      })
    })

    it('returns a process error if no listing found', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(undefined)

      const result = await acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-listing',
        httpStatus: 404,
        response: {
          message: `The parking space ${offer.rentalObjectCode} does not exist or is no longer available.`,
        },
      })
    })

    it('returns a process error if close offer fails', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.detailedOffer.build(),
      })
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const result = await acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'close-offer',
        httpStatus: 500,
        response: {
          message: 'Something went wrong when closing the offer.',
        },
      })
    })
  })

  describe('denyOffer', () => {
    it('returns a process error if no offer found', async () => {
      getOfferByIdSpy.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await denyOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-offer',
        httpStatus: 404,
        response: {
          message: 'The offer 123 does not exist or could not be retrieved.',
        },
      })
    })

    it('returns a process error if no listing found', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(undefined)

      const result = await denyOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-listing',
        httpStatus: 404,
        response: {
          message: `The parking space ${offer.rentalObjectCode} does not exist or is no longer available.`,
        },
      })
    })
  })

  describe('expireOffer', () => {
    it('returns a process error if no offer found', async () => {
      getOfferByIdSpy.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await expireOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-offer',
        httpStatus: 404,
        response: {
          message: 'The offer 123 does not exist or could not be retrieved.',
        },
      })
    })

    it('returns a process error if no listing found', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(undefined)

      const result = await expireOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-listing',
        httpStatus: 404,
        response: {
          message: `The parking space ${offer.rentalObjectCode} does not exist or is no longer available.`,
        },
      })
    })
  })
})
