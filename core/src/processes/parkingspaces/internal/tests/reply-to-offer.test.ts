import { OfferStatus } from 'onecore-types'

import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../../adapters/property-management-adapter'
import { ProcessResult, ProcessStatus } from '../../../../common/types'
import * as processes from '../reply-to-offer'
import * as factory from '../../../../../test/factories'

describe('replyToOffer', () => {
  const getOfferByIdSpy = jest.spyOn(leasingAdapter, 'getOfferByOfferId')
  const getPublishedParkingSpaceSpy = jest.spyOn(
    propertyManagementAdapter,
    'getPublishedParkingSpace'
  )
  const getContactSpy = jest.spyOn(leasingAdapter, 'getContact')

  beforeEach(jest.resetAllMocks)
  describe('acceptOffer', () => {
    it('returns a process error if no offer found', async () => {
      getOfferByIdSpy.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await processes.acceptOffer(123)

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

      const result = await processes.acceptOffer(123)

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

      const result = await processes.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'close-offer',
        httpStatus: 500,
        response: {
          message: 'Something went wrong when closing the offer.',
        },
      })
    })

    it('returns a process error if getting contact fails', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })

      getContactSpy.mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

      jest
        .spyOn(leasingAdapter, 'getOffersForContact')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const result = await processes.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-contact',
        httpStatus: 404,
        response: {
          message: `Contact ${offer.offeredApplicant.contactCode} could not be retrieved.`,
        },
      })
    })

    it('returns a process error if getting other active offers for contact fails', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })

      const contact = factory.contact.build()
      getContactSpy.mockResolvedValueOnce({
        ok: true,
        data: contact,
      })

      jest
        .spyOn(leasingAdapter, 'getOffersForContact')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const result = await processes.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'get-other-offers',
        httpStatus: 500,
        response: {
          message: `Other offers for ${offer.offeredApplicant.contactCode} could not be retrieved.`,
        },
      })
    })

    it('calls denyOffer with remaining offers if exists', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getPublishedParkingSpaceSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })

      const contact = factory.contact.build()
      getContactSpy.mockResolvedValueOnce({
        ok: true,
        data: contact,
      })

      jest.spyOn(leasingAdapter, 'getOffersForContact').mockResolvedValueOnce({
        ok: true,
        data: factory.offerWithRentalObjectCode.buildList(2, {
          id: offer.id + 1,
          status: OfferStatus.Active,
          offeredApplicant: {
            id: offer.offeredApplicant.id,
          },
        }),
      })

      const denyOfferSpy = jest
        .spyOn(processes, 'denyOffer')
        .mockResolvedValueOnce({
          processStatus: ProcessStatus.successful,
        } as ProcessResult)

      const result = await processes.acceptOffer(123)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.successful,
      })

      expect(denyOfferSpy).toHaveBeenCalledTimes(2)
      denyOfferSpy.mockRestore()
    })
  })

  describe('denyOffer', () => {
    it('returns a process error if no offer found', async () => {
      getOfferByIdSpy.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await processes.denyOffer(123)

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

      const result = await processes.denyOffer(123)

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

      const result = await processes.expireOffer(123)

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

      const result = await processes.expireOffer(123)

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
