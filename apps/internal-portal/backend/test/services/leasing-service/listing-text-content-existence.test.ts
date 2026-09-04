import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios'

import { getListingTextContentExistence } from '@/services/leasing-service/adapters/core-adapter'
import { getFromCore } from '@/services/common/adapters/core-adapter'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  generateRouteMetadata: jest.fn(),
}))

jest.mock('@/services/common/adapters/core-adapter')

const mockedGetFromCore = getFromCore as jest.MockedFunction<typeof getFromCore>

const axiosErrorWithStatus = (status: number) =>
  new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  })

describe('getListingTextContentExistence', () => {
  beforeEach(jest.resetAllMocks)

  it('returns the codes that have content', async () => {
    mockedGetFromCore.mockResolvedValueOnce({
      data: { content: ['CODE-1'] },
    } as AxiosResponse)

    const result = await getListingTextContentExistence(['CODE-1', 'CODE-2'])

    expect(result).toEqual({ ok: true, data: ['CODE-1'] })
    expect(mockedGetFromCore).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        data: { rentalObjectCodes: ['CODE-1', 'CODE-2'] },
      })
    )
  })

  it('maps a 400 from core to bad-request', async () => {
    mockedGetFromCore.mockRejectedValueOnce(axiosErrorWithStatus(400))

    const result = await getListingTextContentExistence([])

    expect(result).toEqual({ ok: false, err: 'bad-request', statusCode: 400 })
  })

  it('maps other failures to request-failed', async () => {
    mockedGetFromCore.mockRejectedValueOnce(axiosErrorWithStatus(500))

    const result = await getListingTextContentExistence(['CODE-1'])

    expect(result).toEqual({
      ok: false,
      err: 'request-failed',
      statusCode: 500,
    })
  })
})
