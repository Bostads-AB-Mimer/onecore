import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'

import {
  DetailedOffer,
  Listing,
  OfferStatus,
  OfferWithRentalObjectCode,
  ParkingSpaceAcceptOfferEmail,
  RentalObject,
  ReplyToOfferErrorCodes,
  WaitingListType,
  Lease,
} from '@onecore/types'

import { ProcessResult, ProcessStatus } from '../../../../common/types'
import * as replyProcesses from '../reply-to-offer'
import * as createOfferProcesses from '../create-offer'
import * as factory from '../../../../../test/factories'
import { AdapterResult } from '@/adapters/types'

describe('replyToOffer', () => {
  // Mock out all top level functions, such as get, put, delete and post:
  jest.mock('axios')

  let getOfferByIdSpy: jest.SpyInstance<
      Promise<AdapterResult<DetailedOffer, 'not-found' | 'unknown'>>,
      [offerId: number],
      any
    >,
    getListingByListingIdSpy: jest.SpyInstance<
      Promise<Listing | undefined>,
      [listingId: number],
      any
    >,
    getLeasesForContactCode: jest.SpyInstance<
      Promise<Lease[]>,
      [contactCode: string, options: any],
      any
    >,
    validatePropertyRentalRules: jest.SpyInstance<
      Promise<
        AdapterResult<
          { reason: string; applicationType: 'Replace' | 'Additional' },
          {
            tag:
              | 'not-found'
              | 'unknown'
              | 'not-tenant-in-the-property'
              | 'not-a-parking-space'
            data: unknown
          }
        >
      >,
      [contactCode: string, rentalObjectCode: string],
      any
    >,
    validateResidentialAreaRentalRules: jest.SpyInstance<
      Promise<
        AdapterResult<
          { reason: string; applicationType: 'Replace' | 'Additional' },
          {
            tag: 'not-found' | 'unknown' | 'no-housing-contract-in-the-area'
            data: unknown
          }
        >
      >,
      [contactCode: string, districtCode: string],
      any
    >,
    createLeaseSpy: jest.SpyInstance<
      Promise<any>,
      [
        objectId: string,
        contactId: string,
        fromDate: string,
        companyCode: string,
      ],
      any
    >,
    getOffersForContactSpy: jest.SpyInstance<
      Promise<
        AdapterResult<OfferWithRentalObjectCode[], 'not-found' | 'unknown'>
      >,
      [contactCode: string],
      any
    >,
    resetWaitingListSpy: jest.SpyInstance<
      Promise<AdapterResult<undefined, 'unknown' | 'not-in-waiting-list'>>,
      [contactCode: string, waitingListType: WaitingListType],
      any
    >,
    sendNotificationToRoleSpy: jest.SpyInstance<
      Promise<any>,
      [recipientRole: string, subject: string, message: string],
      any
    >,
    sendParkingSpaceAcceptOfferEmail: jest.SpyInstance<
      Promise<any>,
      [parkingSpaceDetails: ParkingSpaceAcceptOfferEmail],
      any
    >,
    closeOfferByAcceptSpy: jest.SpyInstance<
      Promise<AdapterResult<null, 'unknown' | 'offer-not-found'>>,
      [offerId: number],
      any
    >,
    getParkingSpaceByCodeSpy: jest.SpyInstance<
      Promise<AdapterResult<RentalObject, 'not-found' | 'unknown'>>,
      [rentalObjectCode: string],
      any
    >,
    getContactByContactCodeSpy: jest.SpyInstance<
      Promise<AdapterResult<any, 'not-found' | 'unknown'>>,
      [contactCode: string],
      any
    >,
    denyOfferSpy: jest.SpyInstance<
      Promise<ProcessResult<{ listingId: number }, ReplyToOfferErrorCodes>>,
      [offerId: number],
      any
    >,
    closeOfferByDenySpy: jest.SpyInstance<
      Promise<AdapterResult<null, 'unknown' | 'offer-not-found'>>,
      [offerId: number],
      any
    >

  beforeEach(() => {
    getOfferByIdSpy = jest.spyOn(leasingAdapter, 'getOfferByOfferId')
    getListingByListingIdSpy = jest.spyOn(
      leasingAdapter,
      'getListingByListingId'
    )
    getLeasesForContactCode = jest.spyOn(
      leasingAdapter,
      'getLeasesForContactCode'
    )
    validatePropertyRentalRules = jest.spyOn(
      leasingAdapter,
      'validatePropertyRentalRules'
    )
    validateResidentialAreaRentalRules = jest.spyOn(
      leasingAdapter,
      'validateResidentialAreaRentalRules'
    )
    createLeaseSpy = jest.spyOn(leasingAdapter, 'createLease')
    getOffersForContactSpy = jest.spyOn(leasingAdapter, 'getOffersForContact')
    resetWaitingListSpy = jest.spyOn(leasingAdapter, 'resetWaitingList')

    sendNotificationToRoleSpy = jest.spyOn(
      communicationAdapter,
      'sendNotificationToRole'
    )

    sendParkingSpaceAcceptOfferEmail = jest.spyOn(
      communicationAdapter,
      'sendParkingSpaceAcceptOfferEmail'
    )

    closeOfferByAcceptSpy = jest.spyOn(leasingAdapter, 'closeOfferByAccept')
    closeOfferByDenySpy = jest.spyOn(leasingAdapter, 'closeOfferByDeny')
    denyOfferSpy = jest.spyOn(replyProcesses, 'denyOffer')
    getParkingSpaceByCodeSpy = jest.spyOn(
      leasingAdapter,
      'getParkingSpaceByCode'
    )
    getContactByContactCodeSpy = jest.spyOn(
      leasingAdapter,
      'getContactByContactCode'
    )

    jest.resetAllMocks()
  })
  afterEach(jest.restoreAllMocks)

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
          message: `The listing ${offer.rentalObjectCode} cannot be found.`,
          errorCode: ReplyToOfferErrorCodes.NoListing,
        },
      })
    })

    it('returns success if reset waiting lists fails', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
          })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })

      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
      createLeaseSpy.mockResolvedValueOnce({
        ok: true,
        data: '123-123-123-123/1',
      })
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
      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.contact.build(),
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
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

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
          })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })

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
      const offer = factory.detailedOffer.build()

      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
          })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
      createLeaseSpy.mockResolvedValueOnce({
        ok: true,
        data: '123-123-123-123/1',
      })
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
      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.contact.build(),
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })
    })

    it('should send accept offer email to applicant', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({ rentalObjectCode: listing.rentalObjectCode })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
      createLeaseSpy.mockResolvedValueOnce({
        ok: true,
        data: '123-123-123-123/1',
      })
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })
      const contact = factory.contact.build({
        emailAddress: 'test@example.com',
        firstName: 'Test',
      })
      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: contact,
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
      })

      await replyProcesses.acceptOffer(123)

      expect(sendParkingSpaceAcceptOfferEmail).toHaveBeenCalledTimes(1)
      expect(sendParkingSpaceAcceptOfferEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: contact.emailAddress,
          firstName: contact.firstName,
        })
      )
    })

    it('should return success even if getContactByContactCode fails', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({ rentalObjectCode: listing.rentalObjectCode })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
      createLeaseSpy.mockResolvedValueOnce({
        ok: true,
        data: '123-123-123-123/1',
      })
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })
      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: false,
        err: 'not-found',
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })
      expect(sendParkingSpaceAcceptOfferEmail).not.toHaveBeenCalled()
    })

    it('should return success even if sendParkingSpaceAcceptOfferEmail fails', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({ rentalObjectCode: listing.rentalObjectCode })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
      createLeaseSpy.mockResolvedValueOnce({
        ok: true,
        data: '123-123-123-123/1',
      })
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })
      const contact = factory.contact.build({
        emailAddress: 'test@example.com',
        firstName: 'Test',
      })
      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: contact,
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })
      expect(sendParkingSpaceAcceptOfferEmail).toHaveBeenCalledTimes(1)
    })

    it('calls denyOffer with remaining offers if exists', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
          })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      createLeaseSpy.mockResolvedValueOnce({
        ok: true,
        data: '123-123-123-123/1',
      })

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
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)

      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.contact.build(),
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.successful,
      })

      expect(denyOfferSpy).toHaveBeenCalledTimes(2)
    })

    it('closes accepted offers listing', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
          })
          .build(),
      })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      createLeaseSpy.mockResolvedValueOnce({
        ok: true,
        data: '123-123-123-123/1',
      })

      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)

      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.contact.build(),
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.successful,
      })
    })

    it('creates a lease with start date today if there is no vacant from date', async () => {
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })

      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.detailedOffer.build(),
      })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
            vacantFrom: undefined,
          })
          .build(),
      })

      await replyProcesses.acceptOffer(123)

      expect(createLeaseSpy).toHaveBeenCalledTimes(1)

      const callArgs = createLeaseSpy.mock.calls[0]
      expect(callArgs[2] && new Date(callArgs[2])).toBeSameDayAs(new Date())
    })
    it('creates a lease with start date the day that the rental object is vacant if that is today or in the future', async () => {
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })

      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.detailedOffer.build(),
      })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      const oneMonthFromNow = new Date()
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
            vacantFrom: oneMonthFromNow,
          })
          .build(),
      })

      await replyProcesses.acceptOffer(123)

      expect(createLeaseSpy).toHaveBeenCalledTimes(1)

      const callArgs = createLeaseSpy.mock.calls[0]
      expect(callArgs[2] && new Date(callArgs[2])).toBeSameDayAs(
        oneMonthFromNow
      )
    })

    it('creates a lease with start date today if the last contract ended in the past', async () => {
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })

      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.detailedOffer.build(),
      })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
            vacantFrom: new Date('2023-01-01'),
          })
          .build(),
      })

      await replyProcesses.acceptOffer(123)

      expect(createLeaseSpy).toHaveBeenCalledTimes(1)

      const callArgs = createLeaseSpy.mock.calls[0]
      expect(callArgs[2] && new Date(callArgs[2])).toBeSameDayAs(new Date())
    })

    it('creates a lease with start date today even after 23:00 local time', async () => {
      // Mock system time to 23:30 local time
      const lateHour = new Date()
      lateHour.setHours(23, 30, 0, 0)
      jest.useFakeTimers().setSystemTime(lateHour)

      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })

      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.detailedOffer.build(),
      })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
            vacantFrom: undefined,
          })
          .build(),
      })

      await replyProcesses.acceptOffer(123)

      expect(createLeaseSpy).toHaveBeenCalledTimes(1)
      const callArgs = createLeaseSpy.mock.calls[0]
      // Kontrollera att datumet är samma dag i UTC som det mockade datumet
      expect(callArgs[2] && new Date(callArgs[2])).toBeSameDayAs(
        new Date(lateHour.toISOString())
      )

      jest.useRealTimers()
    })

    it('creates a lease with start date today when vacantFrom is today at 23:59', async () => {
      // Set vacantFrom to today at 23:59 UTC
      const now = new Date()
      const vacantFrom = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          0,
          0
        )
      )

      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })

      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.detailedOffer.build(),
      })
      createLeaseSpy.mockResolvedValueOnce(factory.lease.build())
      getOffersForContactSpy.mockResolvedValueOnce({
        ok: true,
        data: [],
      })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })

      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
            vacantFrom: vacantFrom,
          })
          .build(),
      })

      await replyProcesses.acceptOffer(123)

      expect(createLeaseSpy).toHaveBeenCalledTimes(1)
      const callArgs = createLeaseSpy.mock.calls[0]
      // Kontrollera att lease-datumet är samma dag som idag (UTC)
      expect(new Date(callArgs[2])).toBeSameDayAs(new Date())
    })

    it('should fail if applicant is not a tenant (leases.length < 1)', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })
      getListingByListingIdSpy.mockResolvedValue(factory.listing.build())
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace.build(),
      })
      getLeasesForContactCode.mockResolvedValueOnce([]) // Not a tenant

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: ReplyToOfferErrorCodes.ApplicantNotTenant,
        httpStatus: 403,
        response: expect.objectContaining({
          errorCode: ReplyToOfferErrorCodes.ApplicantNotTenant,
        }),
      })
    })

    it('should call validateResidentialAreaRentalRules and validatePropertyRentalRules with correct arguments', async () => {
      const offer = factory.detailedOffer.build()
      const listing = factory.listing.build()
      const parkingSpace = factory.vacantParkingSpace.build({
        residentialAreaCode: 'AREA1',
      })

      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: parkingSpace,
      })
      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])

      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })
      createLeaseSpy.mockResolvedValueOnce({ ok: true, data: 'lease-id' })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      getOffersForContactSpy.mockResolvedValueOnce({ ok: true, data: [] })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.contact.build(),
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
      })

      await replyProcesses.acceptOffer(123)

      expect(validateResidentialAreaRentalRules).toHaveBeenCalledWith(
        offer.offeredApplicant.contactCode,
        parkingSpace.residentialAreaCode
      )
      expect(validatePropertyRentalRules).toHaveBeenCalledWith(
        offer.offeredApplicant.contactCode,
        offer.rentalObjectCode
      )
    })

    it('should fail if validateResidentialAreaRentalRules returns no-housing-contract-in-the-area', async () => {
      const offer = factory.detailedOffer.build()
      const listing = factory.listing.build()
      const parkingSpace = factory.vacantParkingSpace.build({
        residentialAreaCode: 'AREA1',
      })

      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: parkingSpace,
      })
      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])

      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: false,
        err: {
          tag: 'no-housing-contract-in-the-area',
          data: {},
        },
      })
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-contract-in-the-area',
        httpStatus: 400,
        response: expect.objectContaining({
          errorCode: 'no-contract-in-the-area',
        }),
      })
    })

    it('should fail if validatePropertyRentalRules returns not-tenant-in-the-property', async () => {
      const applicant = factory.detailedApplicant.build({
        applicationType: 'Replace',
      })
      const offer = factory.detailedOffer.build({
        offeredApplicant: applicant,
      })
      const listing = factory.listing.build()
      const parkingSpace = factory.vacantParkingSpace.build({
        residentialAreaCode: 'AREA1',
      })

      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: parkingSpace,
      })
      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])

      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })
      validatePropertyRentalRules.mockResolvedValue({
        ok: false,
        err: {
          tag: 'not-tenant-in-the-property',
          data: {},
        },
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.failed,
        error: 'no-contract-in-the-area',
        httpStatus: 400,
        response: expect.objectContaining({
          errorCode: 'no-contract-in-the-area',
        }),
      })
    })

    it('should succeed if applicant is a tenant and both rental rule validations pass', async () => {
      const applicant = factory.detailedApplicant.build({
        applicationType: 'Replace',
      })
      const offer = factory.detailedOffer.build({
        offeredApplicant: applicant,
      })
      const listing = factory.listing.build()
      const parkingSpace = factory.vacantParkingSpace.build({
        residentialAreaCode: 'AREA1',
      })

      getOfferByIdSpy.mockResolvedValueOnce({ ok: true, data: offer })
      getListingByListingIdSpy.mockResolvedValue(listing)
      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: parkingSpace,
      })
      getLeasesForContactCode.mockResolvedValueOnce([factory.lease.build()])

      validateResidentialAreaRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })
      validatePropertyRentalRules.mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })
      createLeaseSpy.mockResolvedValueOnce({ ok: true, data: 'lease-id' })
      closeOfferByAcceptSpy.mockResolvedValueOnce({ ok: true, data: null })
      getOffersForContactSpy.mockResolvedValueOnce({ ok: true, data: [] })
      resetWaitingListSpy.mockResolvedValue({ ok: true, data: undefined })
      denyOfferSpy.mockResolvedValue({
        processStatus: ProcessStatus.successful,
      } as ProcessResult)
      getContactByContactCodeSpy.mockResolvedValueOnce({
        ok: true,
        data: factory.contact.build(),
      })
      sendParkingSpaceAcceptOfferEmail.mockResolvedValueOnce({
        ok: true,
        data: null,
      })

      const result = await replyProcesses.acceptOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: null,
      })
    })
  })

  describe('denyOffer', () => {
    beforeEach(() => {
      denyOfferSpy.mockRestore()
    })

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
          message: `The listing ${offer.listingId} cannot be found.`,
          errorCode: ReplyToOfferErrorCodes.NoListing,
        },
      })
    })

    it('tries to create new offer', async () => {
      const offer = factory.detailedOffer.build()
      getOfferByIdSpy.mockResolvedValueOnce({
        ok: true,
        data: offer,
      })

      closeOfferByDenySpy.mockResolvedValueOnce({ ok: true, data: null })

      const listing = factory.listing.build()
      getListingByListingIdSpy.mockResolvedValue(listing)

      getParkingSpaceByCodeSpy.mockResolvedValue({
        ok: true,
        data: factory.vacantParkingSpace
          .params({
            rentalObjectCode: listing.rentalObjectCode,
          })
          .build(),
      })

      const createOffer = jest
        .spyOn(createOfferProcesses, 'createOfferForInternalParkingSpace')
        .mockResolvedValueOnce({
          data: null,
          processStatus: ProcessStatus.successful,
          httpStatus: 200,
        })

      const result = await replyProcesses.denyOffer(123)

      expect(result).toEqual({
        processStatus: ProcessStatus.successful,
        httpStatus: 202,
        data: { listingId: expect.any(Number) },
      })
      expect(createOffer).toHaveBeenCalledTimes(1)
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
