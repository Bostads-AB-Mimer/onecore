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

import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../../adapters/property-management-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import * as factory from '../../../../../test/factories'
import { ProcessStatus } from '../../../../common/types'
import { acceptOffer, denyOffer, expireOffer } from '../reply-to-offer'

describe('replyToOffer', () => {
  // Mock out all top level functions, such as get, put, delete and post:
  jest.mock('axios')

  const getOfferByIdSpy = jest.spyOn(leasingAdapter, 'getOfferByOfferId')
  const getPublishedParkingSpaceSpy = jest.spyOn(
    propertyManagementAdapter,
    'getPublishedParkingSpace'
  )

  describe('acceptOffer', () => {
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
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(undefined)

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
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(undefined)

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
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(undefined)

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
  })
})
