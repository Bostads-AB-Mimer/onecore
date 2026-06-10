import axios from 'axios'
import { postChannelLookup } from '@src/services/invoice-service/adapters/stralfors/stralfors-adapter'
jest.mock('@src/common/config', () => require('@test/common/__mocks__/config'))

jest.mock('axios', () => {
  const mockAxios = Object.assign(jest.fn(), {
    post: jest.fn(),
  })
  return { default: mockAxios, __esModule: true }
})

const mockAuthResponse = {
  data: { access_token: 'test-token', token_type: 'Bearer' },
}

const mockPostResponse = {
  data: { correlationId: 'corr-123' },
}

const mockChannels = [
  {
    channel: 'Kivra' as const,
    matchedCandidates: ['191212121212'],
    error: null,
  },
  { channel: 'eInvoiceB2C' as const, matchedCandidates: null, error: null },
]

const mockGetResponse = {
  data: { results: mockChannels },
}

describe('stralforsAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('postChannelLookup', () => {
    it('returns channel results', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      const result = await postChannelLookup(['191212121212'])

      expect(result).toEqual(mockChannels)
    })

    it('polls GET until result is ready', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce({ data: { results: null } })
        .mockResolvedValueOnce({ data: { results: null } })
        .mockResolvedValueOnce(mockGetResponse)

      const result = await postChannelLookup(['191212121212'])

      expect(result).toEqual(mockChannels)
      // 1 POST + 3 GETs
      expect(jest.mocked(axios)).toHaveBeenCalledTimes(4)
    })

    it('throws when maxRetries exceeded', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValue({ data: { results: null } })

      await expect(postChannelLookup(['191212121212'])).rejects.toThrow()
    })

    it('throws when POST request fails', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      const error = Object.assign(new Error('Network error'), { status: 500 })
      jest.mocked(axios).mockRejectedValueOnce(error)

      await expect(postChannelLookup(['191212121212'])).rejects.toThrow()
    })

    it('sends Bearer token in Authorization header', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      await postChannelLookup(['191212121212'])

      expect(jest.mocked(axios)).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('sends correct POST body', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      await postChannelLookup(['191212121212', '198112172385'])

      expect(jest.mocked(axios)).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: {
            channels: ['Kivra', 'eInvoiceB2C'],
            candidates: ['191212121212', '198112172385'],
          },
        })
      )
    })
  })
})
