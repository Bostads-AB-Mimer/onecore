import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as inspectionAdapter from '../../../adapters/inspection-adapter'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import * as schemas from '../schemas'
import { XpandInspectionFactory } from '../../../../test/factories/inspection'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('inspection-service index', () => {
  describe('GET /inspections/xpand', () => {
    const mockInspections = XpandInspectionFactory.buildList(2)

    it('should return inspections from Xpand', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('inspections')
      expect(res.body.content.inspections).toHaveLength(2)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        skip: undefined,
        limit: undefined,
        sortAscending: undefined,
      })
    })

    it('should handle pagination parameters', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: [mockInspections[0]],
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand?skip=10&limit=5&sortAscending=true'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('inspections')
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        skip: 10,
        limit: 5,
        sortAscending: true,
      })
    })

    it('should return 400 on invalid query params', async () => {
      const res = await request(app.callback()).get(
        '/inspections/xpand?skip=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Invalid query parameters')
    })

    it('should return 500 if adapter returns error', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(getXpandInspectionsSpy).toHaveBeenCalled()
    })

    it('should return 500 if adapter throws error', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockRejectedValue(new Error('Network error'))

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandInspectionsSpy).toHaveBeenCalled()
    })

    it('should parse sortAscending as boolean from string', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const resTrue = await request(app.callback()).get(
        '/inspections/xpand?sortAscending=true'
      )

      expect(resTrue.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        skip: undefined,
        limit: undefined,
        sortAscending: true,
      })

      getXpandInspectionsSpy.mockClear()

      const resFalse = await request(app.callback()).get(
        '/inspections/xpand?sortAscending=false'
      )

      expect(resFalse.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        skip: undefined,
        limit: undefined,
        sortAscending: false,
      })
    })

    it('should validate response schema matches CoreInspectionSchema', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.XpandInspectionSchema.array().parse(
          res.body.content.inspections
        )
      ).not.toThrow()
      expect(getXpandInspectionsSpy).toHaveBeenCalled()
    })

    it('should return empty array when no inspections found', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: [],
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toEqual([])
      expect(getXpandInspectionsSpy).toHaveBeenCalled()
    })
  })

  describe('GET /inspections/xpand/residence/:residenceId', () => {
    const mockInspections = XpandInspectionFactory.buildList(2)

    it('should return inspections for a specific residence ID', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('inspections')
      expect(res.body.content.inspections).toHaveLength(2)
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        'residence-123'
      )
    })

    it('should return 404 when no inspections found for residence ID', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: false,
          err: 'not-found',
          statusCode: 404,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('not-found')
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        'residence-123'
      )
    })

    it('should return 500 if adapter returns error', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should return 500 if adapter throws error', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockRejectedValue(new Error('Network error'))

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should validate response schema matches XpandInspectionSchema', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(() =>
        schemas.XpandInspectionSchema.array().parse(
          res.body.content.inspections
        )
      ).not.toThrow()
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should return empty array when no inspections found for residence', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: [],
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toEqual([])
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should handle special characters in residence ID', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-abc-123'
      )

      expect(res.status).toBe(200)
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        'residence-abc-123'
      )
    })
  })
})
