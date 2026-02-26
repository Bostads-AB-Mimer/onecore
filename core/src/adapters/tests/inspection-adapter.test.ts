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
              content: xpandInspectionMock,
              _meta: { totalRecords: 2, page: 1, limit: 25, count: 2 },
              _links: [],
            },
            { status: 200 }
          )
        )
      )

      const result = await inspectionAdapter.getXpandInspections()

      expect(result).toMatchObject({
        ok: true,
        data: {
          content: xpandInspectionMock,
          _meta: { totalRecords: 2, page: 1, limit: 25, count: 2 },
          _links: [],
        },
      })
    })

    it('returns inspection data with query params', async () => {
      mockServer.use(
        http.get(`${config.inspectionService.url}/inspections/xpand`, () =>
          HttpResponse.json(
            {
              content: xpandInspectionMock,
              _meta: { totalRecords: 2, page: 1, limit: 50, count: 2 },
              _links: [],
            },
            { status: 200 }
          )
        )
      )

      const result = await inspectionAdapter.getXpandInspections({
        page: 1,
        limit: 50,
        sortAscending: true,
      })

      expect(result).toMatchObject({
        ok: true,
        data: {
          content: xpandInspectionMock,
          _meta: { totalRecords: 2, page: 1, limit: 50, count: 2 },
          _links: [],
        },
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

  describe(inspectionAdapter.updateInspectionStatus, () => {
    const inspectionId = 'inspection-123'
    const detailedXpandInspectionMock = factory.DetailedXpandInspection.build({
      id: inspectionId,
      status: 'Påbörjad',
    })

    it('returns err with statusCode if request fails', async () => {
      mockServer.use(
        http.patch(
          `${config.inspectionService.url}/inspections/${inspectionId}`,
          () =>
            HttpResponse.json(
              { error: 'Inspection with ID inspection-123 not found' },
              { status: 404 }
            )
        )
      )

      const result = await inspectionAdapter.updateInspectionStatus(
        inspectionId,
        { status: 'Påbörjad' }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('Inspection with ID inspection-123 not found')
        expect(result.statusCode).toBe(404)
      }
    })

    it('returns err for invalid status transition', async () => {
      mockServer.use(
        http.patch(
          `${config.inspectionService.url}/inspections/${inspectionId}`,
          () =>
            HttpResponse.json(
              { error: 'Invalid status transition' },
              { status: 400 }
            )
        )
      )

      const result = await inspectionAdapter.updateInspectionStatus(
        inspectionId,
        { status: 'Genomförd' }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('Invalid status transition')
        expect(result.statusCode).toBe(400)
      }
    })

    it('returns updated inspection data', async () => {
      mockServer.use(
        http.patch(
          `${config.inspectionService.url}/inspections/${inspectionId}`,
          () =>
            HttpResponse.json(
              {
                content: { inspection: detailedXpandInspectionMock },
              },
              { status: 200 }
            )
        )
      )

      const result = await inspectionAdapter.updateInspectionStatus(
        inspectionId,
        { status: 'Påbörjad' }
      )

      expect(result).toMatchObject({
        ok: true,
        data: detailedXpandInspectionMock,
      })
    })
  })
})
