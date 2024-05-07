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

//todo: mock database since actual inserts are happening in the real db

describe('parkingspaces', () => {
  describe('createNoteOfInterestForInternalParkingSpace', () => {
    // Mock out all top level functions, such as get, put, delete and post:
    jest.mock('axios')

    const getParkingSpaceSpy = jest.spyOn(
      propertyManagementAdapter,
      'getPublishedParkingSpace'
    )

    const getContactSpy = jest.spyOn(leasingAdapter, 'getContact')
    const getLeasesForPnrSpy = jest.spyOn(leasingAdapter, 'getLeasesForPnr')
    const getWaitingListSpy = jest.spyOn(leasingAdapter, 'getWaitingList')
    const applyForListingSpy = jest.spyOn(leasingAdapter, 'applyForListing')

    jest.spyOn(leasingAdapter, 'getListingByRentalObjectCode')
    jest.spyOn(leasingAdapter, 'createNewListing')

    it('gets the parking space', async () => {
      getParkingSpaceSpy.mockResolvedValueOnce(mockedParkingSpace)
      await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
        'foo',
        'bar',
        'baz'
      )

      expect(getParkingSpaceSpy).toHaveBeenCalledWith('foo')
    })

    it('returns an error if parking space is could not be found', async () => {
      getParkingSpaceSpy.mockResolvedValueOnce(undefined)

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
      getContactSpy.mockResolvedValueOnce(mockedApplicant)
      getParkingSpaceSpy.mockResolvedValueOnce(mockedParkingSpace)
      getLeasesForPnrSpy.mockResolvedValueOnce([])

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
      getParkingSpaceSpy.mockResolvedValueOnce({
        ...mockedParkingSpace,
        waitingListType: 'Bilplats (extern)',
      })

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
      getParkingSpaceSpy.mockResolvedValueOnce(mockedParkingSpace)

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

    it('passes validation if user belongs to waiting list', async () => {
      getContactSpy.mockResolvedValue(mockedApplicant)
      getParkingSpaceSpy.mockResolvedValueOnce(mockedParkingSpace)
      getLeasesForPnrSpy.mockResolvedValueOnce(mockedLeases)
      getWaitingListSpy.mockResolvedValueOnce(mockedWaitingList)
      applyForListingSpy.mockResolvedValueOnce({ status: 201 } as any)

      const result =
        await parkingProcesses.createNoteOfInterestForInternalParkingSpace(
          'foo',
          'bar',
          'baz'
        )

      expect(result.processStatus).toBe(ProcessStatus.successful)
    })
  })

  //todo: write tests for step 4.b Add parking space listing to onecore-leases
  // todo: write tests for step 4.c Add applicant to onecore-leasing database
})
