import * as leasingAdapter from '../../../../adapters/leasing-adapter'
// import * as propertyManagementAdapter from '../../../../adapters/property-management-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'

import { OfferStatus, ReplyToOfferErrorCodes } from 'onecore-types'

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
        error: ReplyToOfferErrorCodes.NoOffer,
        httpStatus: 404,
        response: {
          message: 'The offer 123 does not exist or could not be retrieved.',
          errorCode: ReplyToOfferErrorCodes.NoOffer,
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
        error: ReplyToOfferErrorCodes.NoListing,
        httpStatus: 404,
        response: {
          message: `The listing ${offer.rentalObjectCode} does not exist or is no longer available.`,
          errorCode: ReplyToOfferErrorCodes.NoListing,
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
        error: ReplyToOfferErrorCodes.CreateLeaseFailure,
        httpStatus: 500,
        response: {
          message: `Create Lease for ${offer.id} failed.`,
          errorCode: ReplyToOfferErrorCodes.CreateLeaseFailure,
        },
      })
    })

    it('returns success even if sendNotificationToRole fails', async () => {
      const closeOfferSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
      const denyOfferSpy = jest.spyOn(replyProcesses, 'denyOffer')

      const offer = factory.detailedOffer.build()

      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })
      getListingByListingIdSpy.mockResolvedValueOnce(factory.listing.build())
      closeOfferSpy.mockResolvedValueOnce({ ok: true, data: null })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
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
      sendNotificationToRoleSpy.mockImplementationOnce(() => {
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
        .mockResolvedValue({
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
        error: ReplyToOfferErrorCodes.NoOffer,
        httpStatus: 404,
        response: {
          message: 'The offer 123 does not exist or could not be retrieved.',
          errorCode: ReplyToOfferErrorCodes.NoOffer,
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
        error: ReplyToOfferErrorCodes.NoListing,
        httpStatus: 404,
        response: {
          message: `The listing ${offer.listingId} does not exist or is no longer available.`,
          errorCode: ReplyToOfferErrorCodes.NoListing,
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
        error: ReplyToOfferErrorCodes.NoOffer,
        httpStatus: 404,
        response: {
          message: 'The offer 123 does not exist or could not be retrieved.',
          errorCode: ReplyToOfferErrorCodes.NoOffer,
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
        error: ReplyToOfferErrorCodes.NoListing,
        httpStatus: 404,
        response: {
          message: `The listing ${offer.listingId} does not exist or is no longer available.`,
          errorCode: ReplyToOfferErrorCodes.NoListing,
        },
      })
    })
  })
})
