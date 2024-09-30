import * as leasingAdapter from '../../../../adapters/leasing-adapter'
// import * as propertyManagementAdapter from '../../../../adapters/property-management-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'

import { OfferStatus } from 'onecore-types'

import { ProcessResult, ProcessStatus } from '../../../../common/types'
import * as replyProcesses from '../reply-to-offer'
import * as factory from '../../../../../test/factories'

describe('replyToOffer', () => {
  // Mock out all top level functions, such as get, put, delete and post:
  jest.mock('axios')

  const getOfferByIdSpy = jest.spyOn(leasingAdapter, 'getOfferByOfferId')
  const getListingByListingIdSpy = jest.spyOn(
    leasingAdapter,
    'getListingByListingId'
  )
  const createLeaseSpy = jest.spyOn(leasingAdapter, 'createLease')
  const getOffersForContactSpy = jest.spyOn(
    leasingAdapter,
    'getOffersForContact'
  )
  const resetWaitingListSpy = jest.spyOn(leasingAdapter, 'resetWaitingList')

  const sendNotificationToRoleSpy = jest.spyOn(
    communicationAdapter,
    'sendNotificationToRole'
  )

  beforeEach(jest.resetAllMocks)
  // afterEach(createLeaseSpy.mockClear)
  // afterEach(createLeaseSpy.mockReset)

  describe('acceptOffer', () => {
    it('returns a process error if no offer found', async () => {
      getOfferByIdSpy.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await replyProcesses.acceptOffer(123)

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
      getListingByListingIdSpy.mockResolvedValueOnce(undefined)

      const result = await replyProcesses.acceptOffer(123)

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
      getListingByListingIdSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValue({
        ok: true,
        data: factory.offerWithRentalObjectCode.buildList(2),
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'close-offer',
        httpStatus: 500,
        response: {
          message: 'Something went wrong when closing the offer.',
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
      getListingByListingIdSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      jest
        .spyOn(leasingAdapter, 'getOffersForContact')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'get-other-offers',
        httpStatus: 500,
        response: {
          message: `Other offers for ${offer.offeredApplicant.contactCode} could not be retrieved.`,
        },
      })
    })

    it('returns success if reset waiting lists fails', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getListingByListingIdSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.offerWithRentalObjectCode.buildList(2, {
          id: offer.id + 1,
          status: OfferStatus.Active,
          offeredApplicant: {
            id: offer.offeredApplicant.id,
          },
        }),
      })
      resetWaitingListSpy.mockResolvedValue({
        ok: false,
        err: 'not-in-waiting-list',
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })
    })

    it('returns a process error if create lease fails', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getListingByListingIdSpy.mockResolvedValueOnce(factory.listing.build())

      createLeaseSpy.mockImplementation(() => {
        throw new Error('Lease not created')
      })

      const result = await replyProcesses.acceptOffer(offer.id)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'create-lease-failed',
        httpStatus: 500,
        response: {
          message: `Create Lease for ${offer.id} failed.`,
        },
      })
    })

    it('returns success even if sendNotificationToRole fails', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getListingByListingIdSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.offerWithRentalObjectCode.buildList(2, {
          id: offer.id + 1,
          status: OfferStatus.Active,
          offeredApplicant: {
            id: offer.offeredApplicant.id,
          },
        }),
      })
      resetWaitingListSpy.mockResolvedValue({
        ok: true,
        data: undefined,
      })
      sendNotificationToRoleSpy.mockImplementation(() => {
        throw new Error('Email not sent')
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })
    })

    it('calls denyOffer with remaining offers if exists', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getListingByListingIdSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())

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
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      const denyOfferSpy = jest
        .spyOn(replyProcesses, 'denyOffer')
        .mockResolvedValueOnce({
          processStatus: ProcessStatus.successful,
        } as ProcessResult)

      const result = await replyProcesses.acceptOffer(123)

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

      const result = await replyProcesses.denyOffer(123)

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
      getListingByListingIdSpy.mockResolvedValueOnce(undefined)

      const result = await replyProcesses.denyOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-listing',
        httpStatus: 404,
        response: {
          message: `The parking space ${offer.listingId} does not exist or is no longer available.`,
        },
      })
    })
  })

  describe('expireOffer', () => {
    it('returns a process error if no offer found', async () => {
      getOfferByIdSpy.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await replyProcesses.expireOffer(123)

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
      getListingByListingIdSpy.mockResolvedValueOnce(undefined)

      const result = await replyProcesses.expireOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-listing',
        httpStatus: 404,
        response: {
          message: `The parking space ${offer.listingId} does not exist or is no longer available.`,
        },
      })
    })
  })
})
