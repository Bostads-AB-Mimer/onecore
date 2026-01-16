import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../common/config'
import * as inspectionAdapter from '../inspection-adapter'
import * as factory from '../../../test/factories'

const mockServer = setupServer()

describe('inspection-adapter', () => {
  beforeAll(() => {
    mockServer.listen()
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  describe(inspectionAdapter.getXpandInspections, () => {
    const xpandInspectionMock = factory.XpandInspection.buildList(3)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.inspectionService.url}/inspections/xpand`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await inspectionAdapter.getXpandInspections()

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns inspection data', async () => {
      mockServer.use(
        http.get(`${config.inspectionService.url}/inspections/xpand`, () =>
          HttpResponse.json(
            {
              content: { inspections: xpandInspectionMock },
            },
            { status: 200 }
          )
        )
      )

      const result = await inspectionAdapter.getXpandInspections()

      expect(result).toMatchObject({
        ok: true,
        data: xpandInspectionMock,
      })
    })

    it('returns inspection data with query params', async () => {
      mockServer.use(
        http.get(`${config.inspectionService.url}/inspections/xpand`, () =>
          HttpResponse.json(
            {
              content: { inspections: xpandInspectionMock },
            },
            { status: 200 }
          )
        )
      )

      const result = await inspectionAdapter.getXpandInspections({
        skip: 10,
        limit: 50,
        sortAscending: true,
      })

      expect(result).toMatchObject({
        ok: true,
        data: xpandInspectionMock,
      })
    })
  })

  describe(inspectionAdapter.getXpandInspectionsByResidenceId, () => {
    const residenceId = '406-028-02-0101'
    const xpandInspectionMock = factory.XpandInspection.buildList(2)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.inspectionService.url}/inspections/xpand/residence/${residenceId}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await inspectionAdapter.getXpandInspectionsByResidenceId(residenceId)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns not-found if no content', async () => {
      mockServer.use(
        http.get(
          `${config.inspectionService.url}/inspections/xpand/residence/${residenceId}`,
          () =>
            HttpResponse.json(
              {
                content: {},
              },
              { status: 200 }
            )
        )
      )

      const result =
        await inspectionAdapter.getXpandInspectionsByResidenceId(residenceId)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('not-found')
    })

    it('returns inspection data', async () => {
      mockServer.use(
        http.get(
          `${config.inspectionService.url}/inspections/xpand/residence/${residenceId}`,
          () =>
            HttpResponse.json(
              {
                content: { inspections: xpandInspectionMock },
              },
              { status: 200 }
            )
        )
      )

      const result =
        await inspectionAdapter.getXpandInspectionsByResidenceId(residenceId)

      expect(result).toMatchObject({
        ok: true,
        data: xpandInspectionMock,
      })
    })
  })
  describe(inspectionAdapter.getXpandInspectionById, () => {
    const inspectionId = 'inspection-123'
    const detailedXpandInspectionMock = factory.DetailedXpandInspection.build()

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.inspectionService.url}/inspections/xpand/${inspectionId}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await inspectionAdapter.getXpandInspectionById(inspectionId)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns inspection data', async () => {
      mockServer.use(
        http.get(
          `${config.inspectionService.url}/inspections/xpand/${inspectionId}`,
          () =>
            HttpResponse.json(
              {
                content: { inspection: detailedXpandInspectionMock },
              },
              { status: 200 }
            )
        )
      )

      const result =
        await inspectionAdapter.getXpandInspectionById(inspectionId)

      expect(result).toMatchObject({
        ok: true,
        data: detailedXpandInspectionMock,
      })
    })
  })
})
