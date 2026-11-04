import { AxiosResponse } from 'axios'
import { WaitingListType } from '@onecore/types'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import {
  NewContactApplicationProfile,
  setUpApplicationProfileAndWaitingLists,
} from '../application-profile-and-waiting-lists'

jest.mock('../../../adapters/leasing-adapter')

const mockSaveProfile =
  leasingAdapter.createOrUpdateApplicationProfileByContactCode as jest.MockedFunction<
    typeof leasingAdapter.createOrUpdateApplicationProfileByContactCode
  >
const mockAddToWaitingList =
  leasingAdapter.addApplicantToWaitingList as jest.MockedFunction<
    typeof leasingAdapter.addApplicantToWaitingList
  >

const contactCode = 'P069077'

const profile: NewContactApplicationProfile = {
  numAdults: 2,
  numChildren: 1,
  housingType: 'RENTAL',
  housingTypeDescription: null,
  landlord: 'Mimer',
  housingReference: { email: 'ref@example.com', phone: '0701234567' },
}

// The process reads only the status, so the rest of the response is left out.
const response = (status: number) => ({ status }) as AxiosResponse

beforeEach(() => {
  jest.resetAllMocks()
  mockSaveProfile.mockResolvedValue({
    ok: true,
    // The process ignores the saved profile, so its shape is irrelevant here.
    data: {} as never,
    statusCode: 201,
  })
  mockAddToWaitingList.mockResolvedValue(response(201))
})

describe('setUpApplicationProfileAndWaitingLists', () => {
  it('does nothing when neither a profile nor any waiting list is requested', async () => {
    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      waitingLists: [],
    })

    expect(result).toEqual({
      applicationProfile: { status: 'skipped' },
      waitingLists: [],
      warnings: [],
    })
    expect(mockSaveProfile).not.toHaveBeenCalled()
    expect(mockAddToWaitingList).not.toHaveBeenCalled()
  })

  it('saves the profile as a new client profile, pending review', async () => {
    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      applicationProfile: profile,
      waitingLists: [],
    })

    expect(result.applicationProfile).toEqual({ status: 'created' })
    expect(result.warnings).toEqual([])
    expect(mockSaveProfile).toHaveBeenCalledWith(
      contactCode,
      expect.objectContaining({
        numAdults: 2,
        numChildren: 1,
        housingType: 'RENTAL',
        landlord: 'Mimer',
        housingReference: expect.objectContaining({
          email: 'ref@example.com',
          phone: '0701234567',
          reviewStatus: 'PENDING',
          reviewedBy: null,
        }),
      })
    )
  })

  it('reports a failed profile as a warning', async () => {
    mockSaveProfile.mockResolvedValue({ ok: false, err: 'bad-params' })

    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      applicationProfile: profile,
      waitingLists: [],
    })

    expect(result.applicationProfile).toEqual({
      status: 'failed',
      error: 'bad-params',
    })
    expect(result.warnings).toEqual([
      'Kunden skapades men hushållsuppgifterna kunde inte sparas.',
    ])
  })

  it('still enrols the waiting lists when the profile fails', async () => {
    mockSaveProfile.mockResolvedValue({ ok: false, err: 'unknown' })

    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      applicationProfile: profile,
      waitingLists: [WaitingListType.Housing],
    })

    expect(result.waitingLists).toEqual([
      { waitingListType: WaitingListType.Housing, status: 'created' },
    ])
  })

  it('enrols every requested waiting list, in order', async () => {
    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      waitingLists: [
        WaitingListType.Housing,
        WaitingListType.ParkingSpace,
        WaitingListType.Storage,
      ],
    })

    expect(result.waitingLists).toEqual([
      { waitingListType: WaitingListType.Housing, status: 'created' },
      { waitingListType: WaitingListType.ParkingSpace, status: 'created' },
      { waitingListType: WaitingListType.Storage, status: 'created' },
    ])
    expect(result.warnings).toEqual([])
    expect(mockAddToWaitingList.mock.calls).toEqual([
      [contactCode, WaitingListType.Housing],
      [contactCode, WaitingListType.ParkingSpace],
      [contactCode, WaitingListType.Storage],
    ])
  })

  it('waits for each enrolment before starting the next', async () => {
    let inFlight = 0
    let maxInFlight = 0
    mockAddToWaitingList.mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setImmediate(resolve))
      inFlight--
      return response(201)
    })

    await setUpApplicationProfileAndWaitingLists(contactCode, {
      waitingLists: [WaitingListType.Housing, WaitingListType.ParkingSpace],
    })

    expect(maxInFlight).toBe(1)
  })

  it('reports a non-201 answer from leasing as a failed queue', async () => {
    // The adapter hands back the raw axios response, which resolves for
    // anything below 500, so a 404 must not read as an enrolment.
    mockAddToWaitingList.mockResolvedValue(response(404))

    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      waitingLists: [WaitingListType.ParkingSpace],
    })

    expect(result.waitingLists).toEqual([
      {
        waitingListType: WaitingListType.ParkingSpace,
        status: 'failed',
        error: '404',
      },
    ])
    expect(result.warnings).toEqual([
      'Kunden skapades men kunde inte ställas i kön för bilplats.',
    ])
  })

  it('reports a thrown enrolment as failed and carries on with the rest', async () => {
    mockAddToWaitingList
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(response(201))

    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      waitingLists: [WaitingListType.Housing, WaitingListType.Storage],
    })

    expect(result.waitingLists).toEqual([
      {
        waitingListType: WaitingListType.Housing,
        status: 'failed',
        error: 'unknown',
      },
      { waitingListType: WaitingListType.Storage, status: 'created' },
    ])
    expect(result.warnings).toEqual([
      'Kunden skapades men kunde inte ställas i kön för bostad.',
    ])
  })

  it('collects one warning per failed step', async () => {
    mockSaveProfile.mockResolvedValue({ ok: false, err: 'unknown' })
    mockAddToWaitingList.mockResolvedValue(response(500))

    const result = await setUpApplicationProfileAndWaitingLists(contactCode, {
      applicationProfile: profile,
      waitingLists: [WaitingListType.ParkingSpace, WaitingListType.Storage],
    })

    expect(result.warnings).toEqual([
      'Kunden skapades men hushållsuppgifterna kunde inte sparas.',
      'Kunden skapades men kunde inte ställas i kön för bilplats.',
      'Kunden skapades men kunde inte ställas i kön för förråd.',
    ])
  })
})
