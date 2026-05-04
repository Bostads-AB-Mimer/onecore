import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../common/config'
import { makeContactsAdapter } from '../contacts-adapter'

const mockServer = setupServer()

describe('contacts-adapter', () => {
  const adapter = makeContactsAdapter(config.contactsService.url)

  beforeAll(() => {
    mockServer.listen()
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  describe('getInvoiceChannels', () => {
    const mockChannels = [
      {
        channel: 'Kivra',
        matchedCandidates: ['P000111'],
        error: null,
      },
      {
        channel: 'eInvoiceB2C',
        matchedCandidates: ['P000222'],
        error: null,
      },
    ]

    it('returns invoice channels for given contact codes', async () => {
      mockServer.use(
        http.post(
          `${config.contactsService.url}/contacts/invoice-channels`,
          () =>
            HttpResponse.json(
              { content: mockChannels, _links: {} },
              { status: 200 }
            )
        )
      )

      const result = await adapter.getInvoiceChannels(['P000111', 'P000222'])

      expect(result).toEqual({ ok: true, data: mockChannels })
    })

    it('passes contact codes in request body', async () => {
      let capturedBody: unknown

      mockServer.use(
        http.post(
          `${config.contactsService.url}/contacts/invoice-channels`,
          async ({ request }) => {
            capturedBody = await request.json()
            return HttpResponse.json({ content: [], _links: {} }, { status: 200 })
          }
        )
      )

      await adapter.getInvoiceChannels(['P000111', 'P000222', 'F111111'])

      expect(capturedBody).toEqual({
        contactCodes: ['P000111', 'P000222', 'F111111'],
      })
    })

    it('returns empty array when no channels found', async () => {
      mockServer.use(
        http.post(
          `${config.contactsService.url}/contacts/invoice-channels`,
          () =>
            HttpResponse.json({ content: [], _links: {} }, { status: 200 })
        )
      )

      const result = await adapter.getInvoiceChannels([])

      expect(result).toEqual({ ok: true, data: [] })
    })

    it('returns channel with error when lookup fails for a candidate', async () => {
      const channelsWithError = [
        {
          channel: 'Kivra',
          matchedCandidates: null,
          error: 'Lookup failed',
        },
      ]

      mockServer.use(
        http.post(
          `${config.contactsService.url}/contacts/invoice-channels`,
          () =>
            HttpResponse.json(
              { content: channelsWithError, _links: {} },
              { status: 200 }
            )
        )
      )

      const result = await adapter.getInvoiceChannels(['P000111'])

      expect(result).toEqual({ ok: true, data: channelsWithError })
    })
  })
})
