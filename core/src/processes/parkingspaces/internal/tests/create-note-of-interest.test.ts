import axios, { AxiosResponse, HttpStatusCode } from 'axios'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as economyAdapter from '../../../../adapters/economy-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import { ProcessStatus } from '../../../../common/types'
import * as parkingProcesses from '../index'
import { ApplicantStatus, ListingStatus, WaitingListType } from '@onecore/types'
import * as factory from '../../../../../test/factories'
import * as processUtils from '../../utils'
import { mockedUnpaidInvoice } from '../../external/tests/index.mocks'

const createAxiosResponse = (status: number, data: any): AxiosResponse => {
  return {
    status,
    statusText: 'ok',
    headers: {},
    config: {
      headers: new axios.AxiosHeaders(),
    },
    data,
  }
}

describe('createNoteOfInterestForInternalParkingSpace', () => {
  // Mock out all top level functions, such as get, put, delete and post:
  jest.mock('axios')

  const mockedLeases = factory.lease.buildList(1)
  const mockedContact = factory.contact.build({
    contactCode: 'P12345',
    nationalRegistrationNumber: '1212121212',
    parkingSpaceWaitingList: {
      queuePoints: 5,
      queueTime: new Date(),
      type: WaitingListType.ParkingSpace,
    },
  })
  const mockedApplicant = factory.applicant.build({
    contactCode: mockedContact.contactCode,
  })
  const mockedRentalObject = factory.rentalObject
    .params({
      vacantFrom: new Date('2023-01-31T23:00:00.000Z'),
      monthlyRent: 698.33,
      address: 'Svarvargatan 4',
      residentialAreaCode: 'MAL',
      residentialAreaCaption: 'Malmaberg',
    })
    .build()
  const mockedListing = factory.listing.build({
    id: 1,
    publishedFrom: new Date('2024-03-26T09:06:56.000Z'),
    publishedTo: new Date('2024-05-04T21:59:59.000Z'),
    rentalObjectCode: '705-808-00-0006',
    rentalRule: 'SCORED',
    applicants: undefined,
    rentalObject: mockedRentalObject,
  })

  const getContactSpy = jest
    .spyOn(leasingAdapter, 'getContactByContactCode')
    .mockResolvedValue({ ok: true, data: mockedContact })
  const getLeasesForContactCodeSpy = jest
    .spyOn(leasingAdapter, 'getLeasesForContactCode')
    .mockResolvedValue(mockedLeases)
  const getInvoicesSentToDebtCollectionSpy = jest
    .spyOn(economyAdapter, 'getInvoicesSentToDebtCollection')
    .mockResolvedValue({ ok: true, data: [] })
  const applyForListingSpy = jest.spyOn(leasingAdapter, 'applyForListing')
  const addApplicantToWaitingListSpy = jest
    .spyOn(leasingAdapter, 'addApplicantToWaitingList')
    .mockResolvedValue(createAxiosResponse(HttpStatusCode.Created, null))

  const getApplicantByContactCodeAndListingIdSpy = jest
    .spyOn(leasingAdapter, 'getApplicantByContactCodeAndListingId')
    .mockResolvedValue({ content: mockedApplicant })

  const getActiveListingByRentalObjectCodeSpy = jest
    .spyOn(leasingAdapter, 'getActiveListingByRentalObjectCode')
    .mockResolvedValue({
      ok: true,
      data: mockedListing,
    })

  const getParkingSpaceByCodeSpy = jest
    .spyOn(leasingAdapter, 'getParkingSpaceByCode')
    .mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })

  const validatePropertyRentalRules = jest
    .spyOn(leasingAdapter, 'validatePropertyRentalRules')
    .mockResolvedValue({
      ok: true,
      data: { reason: '', applicationType: 'Additional' },
    })

  const validateResidentialAreaRentalRules = jest
    .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
    .mockResolvedValue({
      ok: true,
      data: { reason: '', applicationType: 'Additional' },
    })

  const validateRentalRules = jest.spyOn(processUtils, 'validateRentalRules')

  jest
    .spyOn(communicationAdapter, 'sendNotificationToRole')
    .mockResolvedValue({})

  jest
    .spyOn(leasingAdapter, 'setApplicantStatusActive')
    .mockResolvedValue(createAxiosResponse(HttpStatusCode.Ok, null))

  it('gets the parking space', async () => {
    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getActiveListingByRentalObjectCodeSpy).toHaveBeenCalledWith('foo')
  })

  it('returns an error if listing could not be found', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: false,
      err: 'not-found',
    })

    const result =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(result.processStatus).toBe(ProcessStatus.failed)
    expect(result.httpStatus).toBe(404)
  })

  it('returns an error if parking space could not be found', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: false,
      err: 'not-found',
    })

    const result =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(result.processStatus).toBe(ProcessStatus.failed)
    expect(result.httpStatus).toBe(404)
  })

  it('returns an forbidden if the applicant is not a tenant', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue([])

    const result =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(result.processStatus).toBe(ProcessStatus.failed)
    expect(result.httpStatus).toBe(403)
  })

  it('returns an error if parking space is not internal', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: {
        ...mockedListing,
        rentalRule: 'NON_SCORED',
      },
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })

    const result =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(result.processStatus).toBe(ProcessStatus.failed)
    expect(result.httpStatus).toBe(400)
  })

  it('gets the applicant contact', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getContactSpy).toHaveBeenCalledWith('bar')
  })

  it('returns an error if the applicant contact could not be retrieved', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getContactSpy.mockResolvedValue({ ok: false, err: 'unknown' })

    const result =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(result.processStatus).toBe(ProcessStatus.failed)
    expect(result.httpStatus).toBe(404)
  })

  it('returns an error if the applicant is not eligible for renting in area with specific rental rule', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    validatePropertyRentalRules.mockResolvedValueOnce({
      ok: false,
      err: { tag: 'not-found', data: null },
    })
    validateResidentialAreaRentalRules.mockResolvedValueOnce({
      ok: false,
      err: { tag: 'no-housing-contract-in-the-area', data: null },
    })
    validateRentalRules.mockReturnValueOnce({
      ok: false,
      err: 'not-allowed-to-rent-additional',
    })

    const result =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      httpStatus: 400,
      error: 'not-allowed-to-rent-additional',
      response: {
        message:
          'Applicant bar is not eligible for renting due to Residential Area Rental Rules',
        errorCode: 'not-allowed-to-rent-additional',
      },
    })
  })

  it('performs internal credit check', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getInvoicesSentToDebtCollectionSpy).toHaveBeenCalledWith(
      'P12345',
      expect.any(Date)
    )
  })

  it('returns an error if credit check fails', async () => {
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({
      ok: true,
      data: [mockedUnpaidInvoice],
    })

    const result =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(result.processStatus).toBe(ProcessStatus.failed)
    expect(result.httpStatus).toBe(400)
  })

  it('adds applicant to waiting list if not in it already', async () => {
    getContactSpy.mockResolvedValue({
      ok: true,
      data: factory.contact.build({
        contactCode: mockedContact.contactCode,
      }),
    })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })
    applyForListingSpy.mockResolvedValue({ status: 201 } as any)
    addApplicantToWaitingListSpy.mockResolvedValue({} as any)

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(addApplicantToWaitingListSpy).toHaveBeenCalledWith(
      'P12345',
      WaitingListType.ParkingSpace
    )
  })

  it('gets existing listing if applicant passes validation', async () => {
    getContactSpy.mockResolvedValue({
      ok: true,
      data: factory.contact.build({
        contactCode: mockedContact.contactCode,
        nationalRegistrationNumber: mockedContact.nationalRegistrationNumber,
      }),
    })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })
    applyForListingSpy.mockResolvedValue({ status: 201 } as any)

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getActiveListingByRentalObjectCodeSpy).toHaveBeenCalledWith('foo')
  })

  it('adds the applicant if the contact/applicant passes validation', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })
    applyForListingSpy.mockResolvedValue({ status: 201 } as any)
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getApplicantByContactCodeAndListingIdSpy.mockResolvedValue({
      status: 404,
    })

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(applyForListingSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationType: 'Additional',
        contactCode: mockedApplicant.contactCode,
        id: 0,
        listingId: mockedListing.id,
        status: 1,
      })
    )
  })

  it('returns a successful response when applicant has been added', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })
    getApplicantByContactCodeAndListingIdSpy.mockResolvedValue(
      createAxiosResponse(HttpStatusCode.NotFound, null)
    )
    applyForListingSpy.mockResolvedValue({
      ok: true,
      data: mockedApplicant,
    } as any)
    addApplicantToWaitingListSpy.mockResolvedValue(
      createAxiosResponse(HttpStatusCode.Created, null)
    )

    const response =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(response.processStatus).toBe(ProcessStatus.successful)
    expect(response.response.message).toBe(
      'Applicant bar successfully applied to parking space foo'
    )
    expect(response.httpStatus).toBe(200)
  })

  it('returns ProcessStatus.Success if applicant has an application to this listing already', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    applyForListingSpy.mockResolvedValue({
      ok: false,
      err: 'conflict',
    } as any)
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: factory.listing.build({ status: ListingStatus.Active }),
    })
    getApplicantByContactCodeAndListingIdSpy.mockResolvedValue({
      status: 404,
    })

    const response =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(response.processStatus).toBe(ProcessStatus.successful)
    expect(response.response.message).toBe(
      'Applicant bar already has application for foo'
    )
  })

  it('returns ProcessStatus.Success if the user applies a second time after the user has withdrawn the application', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })
    applyForListingSpy.mockResolvedValue({
      status: HttpStatusCode.Ok,
    } as any)
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getApplicantByContactCodeAndListingIdSpy.mockResolvedValue({
      status: HttpStatusCode.Ok,
      data: {
        content: {
          status: ApplicantStatus.WithdrawnByUser,
        },
      },
    })

    const response =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(response.processStatus).toBe(ProcessStatus.successful)
    expect(response.response.message).toBe(
      'Applicant bar successfully applied to parking space foo'
    )
  })

  it('returns ProcessStatus.Success if the user already have active application', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getParkingSpaceByCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedRentalObject,
    })
    getLeasesForContactCodeSpy.mockResolvedValue(mockedLeases)
    getInvoicesSentToDebtCollectionSpy.mockResolvedValue({ ok: true, data: [] })
    applyForListingSpy.mockResolvedValue({
      ok: false,
      err: 'conflict',
    })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: mockedListing,
    })
    getApplicantByContactCodeAndListingIdSpy.mockResolvedValue({
      status: HttpStatusCode.Ok,
      data: {
        content: {
          status: ApplicantStatus.Active,
        },
      },
    })

    const response =
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'Additional'
      )

    expect(response.processStatus).toBe(ProcessStatus.successful)
    expect(response.response.message).toBe(
      'Applicant bar already has application for foo'
    )
  })
})
