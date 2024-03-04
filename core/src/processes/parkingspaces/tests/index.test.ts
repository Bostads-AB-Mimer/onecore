import {
  ConsumerReport,
  Contact,
  ParkingSpace,
  ParkingSpaceApplicationCategory,
} from 'onecore-types'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as communcationAdapter from '../../../adapters/communication-adapter'
import { ProcessStatus } from '../../../common/types'
import * as parkingProcesses from '../index'
import {
  mockedApplicant,
  mockedParkingSpace,
  successfulConsumerReport,
  failedConsumerReport,
  mockedLease,
} from './index.mocks'
import { create } from 'domain'

describe('parkingspaces', () => {
  describe('createLeaseForExternalParkingSpace', () => {
    let getParkingSpaceSpy: jest.SpyInstance<
      Promise<ParkingSpace | undefined>,
      [parkingSpaceId: string],
      any
    >
    let getContactSpy: jest.SpyInstance<
      Promise<Contact | undefined>,
      [contactId: string],
      any
    >
    let getCreditInformationSpy: jest.SpyInstance<
      Promise<ConsumerReport>,
      [nationalRegistrationNumber: string],
      any
    >
    let sendNotificationToContactSpy: jest.SpyInstance<
      Promise<any>,
      [recipientContact: Contact, subject: string, message: string],
      any
    >
    let sendNotificationToRoleSpy: jest.SpyInstance<
      Promise<any>,
      [recipientRole: string, subject: string, message: string],
      any
    >
    let createContractSpy: jest.SpyInstance<
      Promise<any>,
      [
        objectId: string,
        contactId: string,
        fromDate: string,
        companyCode: string
      ],
      any
    >

    beforeEach(() => {
      getParkingSpaceSpy = jest
        .spyOn(propertyManagementAdapter, 'getParkingSpace')
        .mockResolvedValue(mockedParkingSpace)
      getContactSpy = jest
        .spyOn(leasingAdapter, 'getContact')
        .mockResolvedValue(mockedApplicant)
      getCreditInformationSpy = jest
        .spyOn(leasingAdapter, 'getCreditInformation')
        .mockResolvedValue(successfulConsumerReport)
      sendNotificationToContactSpy = jest
        .spyOn(communcationAdapter, 'sendNotificationToContact')
        .mockResolvedValue({})
      sendNotificationToRoleSpy = jest
        .spyOn(communcationAdapter, 'sendNotificationToRole')
        .mockResolvedValue({})
      createContractSpy = jest
        .spyOn(leasingAdapter, 'createLease')
        .mockResolvedValue(mockedLease)
    })

    it('gets the parking space', async () => {
      await parkingProcesses.createLeaseForExternalParkingSpace('foo', 'bar')

      expect(getParkingSpaceSpy).toHaveBeenCalledWith('foo')
    })

    it('returns an error if parking space is could not be found', async () => {
      getParkingSpaceSpy.mockResolvedValue(undefined)

      const result = await parkingProcesses.createLeaseForExternalParkingSpace(
        'foo',
        'bar'
      )

      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(404)
    })

    it('returns an error if parking space is not external', async () => {
      const internalParkingSpace = {
        ...mockedParkingSpace,
        applicationCategory: ParkingSpaceApplicationCategory.internal,
      }
      getParkingSpaceSpy.mockResolvedValue(internalParkingSpace)

      const result = await parkingProcesses.createLeaseForExternalParkingSpace(
        'foo',
        'bar'
      )

      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(400)
    })

    it('gets the applicant contact', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)

      await parkingProcesses.createLeaseForExternalParkingSpace('foo', 'bar')

      expect(getContactSpy).toHaveBeenCalledWith('bar')
    })

    it('returns an error if the applicant contact could not be retrieved', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
      getContactSpy.mockResolvedValue(undefined)

      const result = await parkingProcesses.createLeaseForExternalParkingSpace(
        'foo',
        'bar'
      )

      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(404)
    })

    it('performs an external credit check if applicant has no contracts', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)
      getContactSpy.mockResolvedValue(mockedApplicant)

      const getCreditInformationSpy = jest
        .spyOn(leasingAdapter, 'getCreditInformation')
        .mockResolvedValue(successfulConsumerReport)

      await parkingProcesses.createLeaseForExternalParkingSpace('foo', 'bar')

      expect(getCreditInformationSpy).toHaveBeenCalledWith('1212121212')
    })

    it('fails lease creation if external credit check fails', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)

      jest
        .spyOn(leasingAdapter, 'getContact')
        .mockResolvedValue(mockedApplicant)

      jest
        .spyOn(leasingAdapter, 'getCreditInformation')
        .mockResolvedValue(failedConsumerReport)

      const result = await parkingProcesses.createLeaseForExternalParkingSpace(
        'foo',
        'bar'
      )

      expect(result.processStatus).toBe(ProcessStatus.failed)
      expect(result.httpStatus).toBe(400)
    })

    it('sends a notification to the applicant if external credit check fails', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)

      jest
        .spyOn(leasingAdapter, 'getContact')
        .mockResolvedValue(mockedApplicant)

      jest
        .spyOn(leasingAdapter, 'getCreditInformation')
        .mockResolvedValue(failedConsumerReport)

      await parkingProcesses.createLeaseForExternalParkingSpace('foo', 'bar')

      expect(sendNotificationToContactSpy).toHaveBeenCalledWith(
        expect.anything(),
        'Nekad ansökan om extern bilplats',
        expect.any(String)
      )
    })

    it('sends a notification to the role uthyrning if external credit check fails', async () => {
      getParkingSpaceSpy.mockResolvedValue(mockedParkingSpace)

      jest
        .spyOn(leasingAdapter, 'getContact')
        .mockResolvedValue(mockedApplicant)

      jest
        .spyOn(leasingAdapter, 'getCreditInformation')
        .mockResolvedValue(failedConsumerReport)

      await parkingProcesses.createLeaseForExternalParkingSpace('foo', 'bar')

      expect(sendNotificationToRoleSpy).toHaveBeenCalledWith(
        'uthyrning',
        'Nekad ansökan om extern bilplats',
        expect.any(String)
      )
    })

    it('creates a contract if credit check succeeds', async () => {
      await parkingProcesses.createLeaseForExternalParkingSpace('foo', 'bar')

      expect(createContractSpy).toHaveBeenCalledWith(
        mockedParkingSpace.parkingSpaceId,
        mockedApplicant.contactCode,
        expect.any(String),
        '001'
      )
    })
  })
})
