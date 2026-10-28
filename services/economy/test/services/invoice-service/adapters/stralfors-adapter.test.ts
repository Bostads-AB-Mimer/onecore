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

const recipients = [
  { recipientId: '191212121212', recipientType: 'individual' as const },
  { recipientId: '5512345678', recipientType: 'organization' as const },
]

const mockCandidates = [
  {
    referenceId: '191212121212____individual',
    availableInChannels: ['Kivra'],
    notAvailableInChannels: ['eInvoiceB2C'],
  },
  {
    referenceId: '5512345678____organization',
    availableInChannels: ['eInvoiceB2B'],
    notAvailableInChannels: [],
  },
]

const mockGetResponse = {
  data: { candidates: mockCandidates, channelErrors: [] },
}

const notReadyError = Object.assign(new Error('Not Found'), { status: 404 })

describe('stralforsAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('postChannelLookup', () => {
    it('returns channel results with the referenceId suffix stripped', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      const result = await postChannelLookup(recipients)

      expect(result).toEqual({
        candidates: [
          {
            referenceId: '191212121212',
            availableInChannels: ['Kivra'],
            notAvailableInChannels: ['eInvoiceB2C'],
          },
          {
            referenceId: '5512345678',
            availableInChannels: ['eInvoiceB2B'],
            notAvailableInChannels: [],
          },
        ],
        channelErrors: [],
      })
    })

    it('passes through channelErrors from the response', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      const responseWithErrors = {
        data: {
          candidates: mockCandidates,
          channelErrors: [{ channel: 'Kivra', error: 'timeout' }],
        },
      }
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(responseWithErrors)

      const result = await postChannelLookup(recipients)

      expect(result.channelErrors).toEqual([
        { channel: 'Kivra', error: 'timeout' },
      ])
    })

    it('polls GET until result is ready', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockRejectedValueOnce(notReadyError)
        .mockRejectedValueOnce(notReadyError)
        .mockResolvedValueOnce(mockGetResponse)

      const result = await postChannelLookup(recipients)

      expect(result.candidates).toHaveLength(2)
      expect(jest.mocked(axios)).toHaveBeenCalledTimes(4)
    })

    it('throws when maxRetries exceeded', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockRejectedValue(notReadyError)

      await expect(postChannelLookup(recipients)).rejects.toThrow()
    })

    it('throws when POST request fails', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      const error = Object.assign(new Error('Network error'), { status: 500 })
      jest.mocked(axios).mockRejectedValueOnce(error)

      await expect(postChannelLookup(recipients)).rejects.toThrow()
    })

    it('sends Bearer token in Authorization header', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      await postChannelLookup(recipients)

      expect(jest.mocked(axios)).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('sends correct POST body, mapping individuals to a single Kivra/eInvoiceB2C candidate and organizations to eInvoiceB2B', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      await postChannelLookup(recipients)

      expect(jest.mocked(axios)).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: {
            candidates: [
              {
                referenceId: '191212121212____individual',
                kivraRecipient: { ssn: '191212121212' },
                einvoiceB2CRecipient: { ssn: '191212121212' },
              },
              {
                referenceId: '5512345678____organization',
                kivraRecipient: { ssn: '5512345678' },
                einvoiceB2BRecipient: {
                  lookupId: '5512345678',
                  format: 'INVOICE',
                  iso6523Code: '0007',
                },
              },
            ],
          },
        })
      )
    })

    it('strips non-numeric characters from recipientId, but keeps them in the referenceId suffix', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      await postChannelLookup([
        { recipientId: '19121212-1212', recipientType: 'individual' },
        { recipientId: '551234-5678', recipientType: 'organization' },
      ])

      expect(jest.mocked(axios)).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: {
            candidates: [
              {
                referenceId: '19121212-1212____individual',
                kivraRecipient: { ssn: '191212121212' },
                einvoiceB2CRecipient: { ssn: '191212121212' },
              },
              {
                referenceId: '551234-5678____organization',
                kivraRecipient: { ssn: '5512345678' },
                einvoiceB2BRecipient: {
                  lookupId: '5512345678',
                  format: 'INVOICE',
                  iso6523Code: '0007',
                },
              },
            ],
          },
        })
      )
    })

    it('gives an individual and organization sharing the same recipientId distinct referenceIds', async () => {
      jest.mocked(axios.post).mockResolvedValue(mockAuthResponse)
      jest
        .mocked(axios)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockGetResponse)

      await postChannelLookup([
        { recipientId: '191212121212', recipientType: 'individual' },
        { recipientId: '191212121212', recipientType: 'organization' },
      ])

      expect(jest.mocked(axios)).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: {
            candidates: [
              {
                referenceId: '191212121212____individual',
                kivraRecipient: { ssn: '191212121212' },
                einvoiceB2CRecipient: { ssn: '191212121212' },
              },
              {
                referenceId: '191212121212____organization',
                kivraRecipient: { ssn: '191212121212' },
                einvoiceB2BRecipient: {
                  lookupId: '191212121212',
                  format: 'INVOICE',
                  iso6523Code: '0007',
                },
              },
            ],
          },
        })
      )
    })
  })
})
