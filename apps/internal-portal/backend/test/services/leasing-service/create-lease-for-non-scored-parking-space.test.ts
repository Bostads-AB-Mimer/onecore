import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios'
import { logger } from '@onecore/utilities'

import { createLeaseForNonScoredParkingSpace } from '@/services/leasing-service/adapters/core-adapter'
import { getFromCore } from '@/services/common/adapters/core-adapter'

jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  generateRouteMetadata: jest.fn(),
}))
jest.mock('@/services/common/adapters/core-adapter')

const mockedGetFromCore = getFromCore as jest.MockedFunction<typeof getFromCore>
const mockedLogger = logger as jest.Mocked<typeof logger>

const params = {
  parkingSpaceId: '206-705-00-0005',
  contactCode: 'P123456',
  startDate: '2026-12-01',
}

// Only data is read from core's answer; the rest of AxiosResponse is filler.
const coreAnswers = (content: unknown) =>
  mockedGetFromCore.mockResolvedValueOnce({
    data: { content },
  } as AxiosResponse)

describe(createLeaseForNonScoredParkingSpace, () => {
  beforeEach(jest.clearAllMocks)

  it('passes on the VAT decision from core', async () => {
    coreAnswers({
      leaseId: '206-705-00-0005/04',
      creditCheckType: 'intern',
      vat: { includeVAT: true, reason: 'no-housing-contract-in-area' },
    })

    const result = await createLeaseForNonScoredParkingSpace(params)

    expect(result).toEqual({
      ok: true,
      data: {
        leaseId: '206-705-00-0005/04',
        creditCheckType: 'intern',
        vat: { includeVAT: true, reason: 'no-housing-contract-in-area' },
      },
    })
  })

  it('still succeeds without a VAT decision when core sends an invalid one, because the lease exists', async () => {
    coreAnswers({
      leaseId: '206-705-00-0005/04',
      vat: { includeVAT: 'yes', reason: 'something-else' },
    })

    const result = await createLeaseForNonScoredParkingSpace(params)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.vat).toBeUndefined()
    expect(mockedLogger.warn).toHaveBeenCalled()
  })

  it('maps get-tenant-failed from core', async () => {
    mockedGetFromCore.mockRejectedValueOnce(
      new AxiosError('Request failed', '500', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { error: 'get-tenant-failed' },
      })
    )

    const result = await createLeaseForNonScoredParkingSpace(params)

    expect(result).toEqual({
      ok: false,
      err: 'get-tenant-failed',
      statusCode: 500,
    })
  })
})
