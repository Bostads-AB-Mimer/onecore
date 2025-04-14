import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../common/config'
import * as propertyBaseAdapter from '../property-base-adapter'
import * as factory from '../../../test/factories'

const mockServer = setupServer()

describe('property-base-adapter', () => {
  beforeAll(() => {
    mockServer.listen()
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  describe('getResidenceDetails', () => {
    it('returns err if request fails', async () => {
      const residenceMock = factory.residence.build()

      mockServer.use(
        http.get(
          `${config.propertyBaseService.url}/residences/${residenceMock.id}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await propertyBaseAdapter.getResidenceDetails(
        residenceMock.id
      )

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns not-found if residence is not found', async () => {
      const residenceMock = factory.residence.build()

      mockServer.use(
        http.get(
          `${config.propertyBaseService.url}/residences/${residenceMock.id}`,
          () => new HttpResponse(null, { status: 404 })
        )
      )

      const result = await propertyBaseAdapter.getResidenceDetails(
        residenceMock.id
      )

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('not-found')
    })

    it('returns residence', async () => {
      const residenceMock = factory.residence.build()
      mockServer.use(
        http.get(
          `${config.propertyBaseService.url}/residences/${residenceMock.id}`,
          () =>
            HttpResponse.json(
              {
                content: residenceMock,
              },
              { status: 200 }
            )
        )
      )

      const result = await propertyBaseAdapter.getResidenceDetails(
        residenceMock.id
      )

      expect(result).toMatchObject({
        ok: true,
        data: residenceMock,
      })
    })
  })
})
