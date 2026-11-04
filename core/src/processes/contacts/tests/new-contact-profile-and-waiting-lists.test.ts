import { AxiosError, AxiosResponse } from 'axios'
import { logger } from '@onecore/utilities'
import { WaitingListType } from '@onecore/types'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { UpdateClientApplicationProfileRequestParams } from '../../../services/lease-service/helpers/application-profile'
import { setUpNewContactProfileAndWaitingLists } from '../new-contact-profile-and-waiting-lists'

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

const profile: UpdateClientApplicationProfileRequestParams = {
  numAdults: 2,
  numChildren: 1,
  housingType: 'RENTAL',
  housingTypeDescription: null,
  landlord: 'Mimer',
  housingReference: { email: 'ref@example.com', phone: '0701234567' },
}

// The process reads only the status, so the rest of the response is left out.
const response = (status: number) => ({ status }) as AxiosResponse

/**
 * What the leasing adapter actually rejects with when leasing answers 500 or
 * higher: the shared axios instance resolves only statuses below 500.
 */
const rejectedByLeasing = (status: number, error: string) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    undefined,
    undefined,
    // Only status and body are read from a rejected response.
    { status, data: { error } } as AxiosResponse
  )

const savedProfile = {
  ok: true as const,
  // The process ignores the saved profile, so its shape is irrelevant here.
  data: {} as never,
  statusCode: 201,
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(logger, 'error').mockImplementation(() => {})
  mockSaveProfile.mockResolvedValue(savedProfile)
  mockAddToWaitingList.mockResolvedValue(response(201))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('setUpNewContactProfileAndWaitingLists', () => {
  it('does nothing when neither a profile nor any waiting list is requested', async () => {
    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
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
    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
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

    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
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

    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
      applicationProfile: profile,
      waitingLists: [WaitingListType.Housing],
    })

    expect(result.waitingLists).toEqual([
      { waitingListType: WaitingListType.Housing, status: 'created' },
    ])
  })

  it('starts the waiting lists without waiting for the profile', async () => {
    let releaseProfile: () => void = () => {}
    mockSaveProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseProfile = () => resolve(savedProfile)
        })
    )

    const pending = setUpNewContactProfileAndWaitingLists(contactCode, {
      applicationProfile: profile,
      waitingLists: [WaitingListType.Housing],
    })
    await new Promise((resolve) => setImmediate(resolve))

    expect(mockAddToWaitingList).toHaveBeenCalledWith(
      contactCode,
      WaitingListType.Housing
    )

    releaseProfile()
    expect((await pending).applicationProfile).toEqual({ status: 'created' })
  })

  it('enrols every requested waiting list, in order', async () => {
    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
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

    await setUpNewContactProfileAndWaitingLists(contactCode, {
      waitingLists: [WaitingListType.Housing, WaitingListType.ParkingSpace],
    })

    expect(maxInFlight).toBe(1)
  })

  it('reports a 404 from leasing as a failed queue', async () => {
    // Below 500 the adapter resolves with the raw axios response, so a 404
    // must not read as an enrolment.
    mockAddToWaitingList.mockResolvedValue(response(404))

    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
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

  it('reports a 500 from leasing as a failed queue with its status', async () => {
    mockAddToWaitingList.mockRejectedValue(
      rejectedByLeasing(500, 'Waiting list type does not exist in Xpand')
    )

    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
      waitingLists: [WaitingListType.Storage],
    })

    expect(result.waitingLists).toEqual([
      {
        waitingListType: WaitingListType.Storage,
        status: 'failed',
        error: '500',
      },
    ])
    expect(result.warnings).toEqual([
      'Kunden skapades men kunde inte ställas i kön för förråd.',
    ])
  })

  it("logs leasing's reason for a rejected enrolment, not the axios error", async () => {
    mockAddToWaitingList.mockRejectedValue(
      rejectedByLeasing(500, 'Waiting list type does not exist in Xpand')
    )

    await setUpNewContactProfileAndWaitingLists(contactCode, {
      waitingLists: [WaitingListType.Storage],
    })

    expect(logger.error).toHaveBeenCalledWith(
      {
        contactCode,
        waitingListType: WaitingListType.Storage,
        status: 500,
        error: 'Waiting list type does not exist in Xpand',
      },
      expect.any(String)
    )
  })

  it('reports an enrolment that never got an answer as unknown and carries on', async () => {
    mockAddToWaitingList
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(response(201))

    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
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
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, error: 'socket hang up' }),
      expect.any(String)
    )
  })

  it('lists the profile warning first, then one per failed queue in order', async () => {
    // The profile fails last, after the queues, to show the order is fixed
    // rather than the order the steps finish in.
    mockSaveProfile.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: false, err: 'unknown' }), 5)
        )
    )
    mockAddToWaitingList.mockRejectedValue(rejectedByLeasing(503, 'down'))

    const result = await setUpNewContactProfileAndWaitingLists(contactCode, {
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
