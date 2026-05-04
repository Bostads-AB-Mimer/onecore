import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'

describe('POST /contacts/invoice-channels', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  const stralforsAdapter = {
    postChannelLookup: jest.fn(),
  }

  const mockChannels = [
    { channel: 'Kivra' as const, matchedCandidates: ['191212121212'], error: null },
    { channel: 'eInvoiceB2C' as const, matchedCandidates: null, error: null },
  ]

  beforeAll(async () => {
    testApp = await makeTestAppFixture({ stralforsAdapter })
    await testApp.start()
    httpClient = testApp.makeClient()
  })

  afterAll(async () => {
    if (testApp) {
      await testApp.stop()
      testApp = undefined
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with channel data', async () => {
    stralforsAdapter.postChannelLookup.mockResolvedValue(mockChannels)

    const response = await httpClient.post('/contacts/invoice-channels', {
      contactCodes: ['P000111', 'P000222'],
    })

    expect(response.status).toBe(200)
    expect(response.data.content).toEqual(mockChannels)
  })

  it('returns 500 when adapter throws', async () => {
    stralforsAdapter.postChannelLookup.mockRejectedValue(new Error('Strålfors unavailable'))

    await expect(
      httpClient.post('/contacts/invoice-channels', {
        contactCodes: ['P000111'],
      })
    ).rejects.toMatchObject({ response: { status: 500 } })
  })
})
