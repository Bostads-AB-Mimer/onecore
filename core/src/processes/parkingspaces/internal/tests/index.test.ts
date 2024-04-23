import {
  Applicant,
  Contact,
  Lease,
  Listing,
  ParkingSpaceApplicationCategory,
  WaitingList,
} from 'onecore-types'
import * as propertyManagementAdapter from '../../../../adapters/property-management-adapter'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import { ProcessStatus } from '../../../../common/types'
import * as parkingProcesses from '../index'
import {
  mockedApplicant,
  mockedParkingSpace,
  mockedLeases,
  mockedWaitingList,
} from './index.mocks'
import { create } from 'domain'
import exp from 'constants'

//todo: mock database since actual inserts are happening in the real db

describe('parkingspaces', () => {
  describe('createNoteOfInterestForInternalParkingSpace', () => {
    let getParkingSpaceSpy: jest.SpyInstance<
      Promise<Listing | undefined>,
      [parkingSpaceId: string],
      any
    >
    let getContactSpy: jest.SpyInstance<
      Promise<Contact | undefined>,
      [contactId: string],
      any
    >
    let getLeasesForPnrSpy: jest.SpyInstance<
      Promise<Lease[] | undefined>,
      [
        nationalRegistrationNumber: string,
        includeTerminatedLeases: string | string[] | undefined,
        includeContacts: string | string[] | undefined,
      ],
      any
    >
    let getWaitingListSpy: jest.SpyInstance<
      Promise<WaitingList[] | undefined>,
      [nationalRegistrationNumber: string],
      any
    >
    let getListingByRentalObjectCodeSpy: jest.SpyInstance<
      Promise<any | undefined>,
      [rentalObjectCode: string],
      any
    >
    let createNewListingSpy: jest.SpyInstance<
      Promise<any | undefined>,
      [listingData: Listing],
      any
    >
    let applyForListingSpy: jest.SpyInstance<
      Promise<any | undefined>,
      [applicantData: Applicant],
      any
    >

    // Mock out all top level functions, such as get, put, delete and post:
    jest.mock('axios')

    beforeEach(() => {
      getParkingSpaceSpy = jest
        .spyOn(propertyManagementAdapter, 'getPublishedParkingSpace')
        .mockResolvedValue(mockedParkingSpace)
      getContactSpy = jest
        .spyOn(leasingAdapter, 'getContact')
        .mockResolvedValue(mockedApplicant)
      getLeasesForPnrSpy = jest
        .spyOn(leasingAdapter, 'getLeasesForPnr')
        .mockResolvedValue(mockedLeases)
      getWaitingListSpy = jest
        .spyOn(leasingAdapter, 'getWaitingList')
        .mockResolvedValue(mockedWaitingList)
      //todo: mock axios response with body
      getListingByRentalObjectCodeSpy = jest.spyOn(
        leasingAdapter,
        'getListingByRentalObjectCode'
      )
      //todo: mock axios response with body
      createNewListingSpy = jest.spyOn(leasingAdapter, 'createNewListing')
      //todo: mock axios response with body
      applyForListingSpy = jest.spyOn(leasingAdapter, 'applyForListing')
    })

    it('gets the parking space', async () => {
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'baz'
      )

      expect(getParkingSpaceSpy).toHaveBeenCalledWith('foo')
    })

    it('returns an error if parking space is could not be found', async () => {
      getParkingSpaceSpy.mockResolvedValue(undefined)

      const result =
        await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
          'foo',
          'bar',
          'baz'
        )

      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(404)
    })

    it('returns an forbidden if the applicant is not a tenant', async () => {
      getLeasesForPnrSpy.mockResolvedValue([])
      const result =
        await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
          'foo',
          'bar',
          'baz'
        )
      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(403)
    })

    it('returns an error if parking space is not internal', async () => {
      const internalParkingSpace = {
        ...mockedParkingSpace,
        applicationCategory: ParkingSpaceApplicationCategory.external,
      }
      getParkingSpaceSpy.mockResolvedValue(internalParkingSpace)

      const result =
        await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
          'foo',
          'bar',
          'baz'
        )

      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(400)
    })

    it('gets the applicant contact', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)

      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'baz'
      )

      expect(getContactSpy).toHaveBeenCalledWith('bar')
    })

    it('returns an error if the applicant contact could not be retrieved', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
      getContactSpy.mockResolvedValue(undefined)

      const result =
        await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
          'foo',
          'bar',
          'baz'
        )

      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(404)
    })

    it('pass validation if user belongs to waiting list', async () => {
      const logSpy = jest.spyOn(global.console, 'log')
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'baz'
      )
      expect(logSpy.mock.calls[0][0].length).toBe(4)
      expect(logSpy.mock.calls[0][0][3]).toEqual(
        'Validering genomförd. Sökande godkänd för att anmäla intresse på bilplats foo'
      )
    })
  })

  //todo: write tests for step 4.b Add parking space listing to onecore-leases

  // todo: write tests for step 4.c Add applicant to onecore-leasing database
})
