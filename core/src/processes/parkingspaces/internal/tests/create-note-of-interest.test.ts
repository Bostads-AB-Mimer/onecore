import axios, { AxiosResponse, HttpStatusCode } from 'axios'
import * as propertyManagementAdapter from '../../../../adapters/property-management-adapter'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import { ProcessStatus } from '../../../../common/types'
import * as parkingProcesses from '../index'
import { ApplicantStatus, ListingStatus, WaitingListType } from 'onecore-types'
import * as factory from '../../../../../test/factories'
import * as processUtils from '../../utils'
import { ListingFactory } from '../../../../../test/factories/listing'

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

  const getParkingSpaceSpy = jest.spyOn(
    propertyManagementAdapter,
    'getPublishedParkingSpace'
  )
  const sharedListing = ListingFactory.build()

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
  const mockedParkingSpace = factory.listing.build({
    id: 1,
    vacantFrom: new Date('2023-01-31T23:00:00.000Z'),
    publishedFrom: new Date('2024-03-26T09:06:56.000Z'),
    publishedTo: new Date('2024-05-04T21:59:59.000Z'),
    rentalObjectCode: '705-808-00-0006',
    monthlyRent: 698.33,
    address: 'Svarvargatan 4',
    applicants: undefined,
  })

  const getContactSpy = jest
    .spyOn(leasingAdapter, 'getContact')
    .mockResolvedValue({ ok: true, data: mockedContact })
  const getLeasesForPnrSpy = jest
    .spyOn(leasingAdapter, 'getLeasesForPnr')
    .mockResolvedValue(mockedLeases)
  const getInternalCreditInformationSpy = jest
    .spyOn(leasingAdapter, 'getInternalCreditInformation')
    .mockResolvedValue(true)
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
      data: sharedListing,
    })
  const createNewListingSpy = jest.spyOn(leasingAdapter, 'createNewListing')

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
    .spyOn(leasingAdapter, 'getActiveListingByRentalObjectCode')
    .mockResolvedValue({
      ok: true,
      data: sharedListing,
    })
  jest.spyOn(leasingAdapter, 'createNewListing').mockResolvedValue({
    ok: true,
    data: sharedListing,
  })

  jest
    .spyOn(leasingAdapter, 'setApplicantStatusActive')
    .mockResolvedValue(createAxiosResponse(HttpStatusCode.Ok, null))

  it('gets the parking space', async () => {
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getParkingSpaceSpy).toHaveBeenCalledWith('foo')
  })

  it('returns an error if parking space could not be found', async () => {
    getParkingSpaceSpy.mockResolvedValue(undefined)

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
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue([])

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
    getParkingSpaceSpy.mockResolvedValue({
      ...mockedParkingSpace,
      waitingListType: 'Bilplats (extern)',
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
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getContactSpy).toHaveBeenCalledWith('bar')
  })

  it('returns an error if the applicant contact could not be retrieved', async () => {
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
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
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
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
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getInternalCreditInformationSpy).toHaveBeenCalledWith('P12345')
  })

  it('returns an error if credit check fails', async () => {
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(false)

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
        nationalRegistrationNumber: mockedContact.nationalRegistrationNumber,
      }),
    })
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
    applyForListingSpy.mockResolvedValue({ status: 201 } as any)
    addApplicantToWaitingListSpy.mockResolvedValue({} as any)

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(addApplicantToWaitingListSpy).toHaveBeenCalledWith(
      '1212121212',
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
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
    applyForListingSpy.mockResolvedValue({ status: 201 } as any)

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(getActiveListingByRentalObjectCodeSpy).toHaveBeenCalledWith('foo')
  })

  it("creates new listing if it hasn't been added already", async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
    applyForListingSpy.mockResolvedValue({ status: 201 } as any)
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: false,
      err: 'not-found',
    })

    await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
      'foo',
      'bar',
      'Additional'
    )

    expect(createNewListingSpy).toHaveBeenCalledWith({
      address: 'Svarvargatan 4',
      blockCaption: 'LINDAREN 2',
      blockCode: '1401',
      districtCaption: 'Malmaberg',
      districtCode: 'MAL',
      id: 1,
      monthlyRent: 698.33,
      objectTypeCaption: 'Carport',
      objectTypeCode: 'CPORT',
      publishedFrom: new Date('2024-03-26T09:06:56.000Z'),
      publishedTo: new Date('2024-05-04T21:59:59.000Z'),
      rentalObjectCode: '705-808-00-0006',
      rentalObjectTypeCaption: 'Standard hyresobjektstyp',
      rentalObjectTypeCode: 'STD',
      status: 1,
      vacantFrom: new Date('2023-01-31T23:00:00.000Z'),
      waitingListType: 'Bilplats (intern)',
    })
  })

  it('adds the applicant if the contact/applicant passes validation', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
    applyForListingSpy.mockResolvedValue({ status: 201 } as any)
    createNewListingSpy.mockResolvedValue({
      ok: true,
      data: sharedListing,
    })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: sharedListing,
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
        listingId: sharedListing.id,
        status: 1,
      })
    )
  })

  it('returns a successful response when applicant has been added', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
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

    createNewListingSpy.mockResolvedValue({
      ok: true,
      data: sharedListing,
    })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: false,
      err: 'not-found',
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
    expect(response.httpStatus).toBe(200)
  })

  it('returns ProcessStatus.Success if applicant has an application to this listing already', async () => {
    getContactSpy.mockResolvedValue({ ok: true, data: mockedContact })
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
    createNewListingSpy.mockResolvedValue({
      ok: true,
      data: factory.listing.build({ status: ListingStatus.Active }),
    })
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
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
    applyForListingSpy.mockResolvedValue({
      status: HttpStatusCode.Ok,
    } as any)
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: sharedListing,
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
    getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
    getLeasesForPnrSpy.mockResolvedValue(mockedLeases)
    getInternalCreditInformationSpy.mockResolvedValue(true)
    applyForListingSpy.mockResolvedValue({
      ok: false,
      err: 'conflict',
    })
    getActiveListingByRentalObjectCodeSpy.mockResolvedValue({
      ok: true,
      data: sharedListing,
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
