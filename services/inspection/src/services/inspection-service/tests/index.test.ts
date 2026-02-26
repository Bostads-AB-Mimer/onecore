import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as xpandAdapter from '../adapters/xpand-adapter'
import * as dbAdapter from '../adapters/db-adapter'
import {
  XpandInspectionFactory,
  DetailedXpandInspectionFactory,
} from './factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('inspection-service', () => {
  describe('GET /inspections/xpand', () => {
    it('responds with an array of inspections', async () => {
      const mockInspections = [
        XpandInspectionFactory.build({
          id: 'INS001',
          status: 'Registrerad',
        }),
        XpandInspectionFactory.build({ id: 'INS002', status: 'Genomförd' }),
      ]
      const getInspectionsSpy = jest
        .spyOn(xpandAdapter, 'getInspections')
        .mockResolvedValueOnce({
          ok: true,
          data: {
            inspections: mockInspections,
            totalRecords: 2,
          },
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(res.body.content).toBeInstanceOf(Array)
      expect(getInspectionsSpy).toHaveBeenCalled()
      expect(res.body.content.length).toBe(2)
    })

    it('handles adapter errors', async () => {
      const getInspectionsSpy = jest
        .spyOn(xpandAdapter, 'getInspections')
        .mockResolvedValueOnce({ ok: false, err: 'schema-error' })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(getInspectionsSpy).toHaveBeenCalled()
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'Failed to fetch inspections from Xpand: schema-error'
      )
    })

    it('handles unhandled errors', async () => {
      const getInspectionsSpy = jest
        .spyOn(xpandAdapter, 'getInspections')
        .mockImplementation(() => {
          throw new Error('Database connection failed')
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(getInspectionsSpy).toHaveBeenCalled()
      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Database connection failed')
    })
  })

  describe('GET /inspections/xpand/residence/:residenceId', () => {
    it('responds with an array of inspections for the residence', async () => {
      const residenceId = 'RES001'
      const getInspectionsByResidenceIdSpy = jest
        .spyOn(xpandAdapter, 'getInspectionsByResidenceId')
        .mockResolvedValueOnce({
          ok: true,
          data: [
            XpandInspectionFactory.build({
              id: 'INS001',
              status: 'Registrerad',
            }),
            XpandInspectionFactory.build({
              id: 'INS002',
              status: 'Genomförd',
            }),
          ],
        })

      const res = await request(app.callback()).get(
        `/inspections/xpand/residence/${residenceId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toBeInstanceOf(Array)
      expect(getInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        residenceId,
        undefined
      )
      expect(res.body.content.inspections.length).toBe(2)
    })

    it('handles adapter errors', async () => {
      const residenceId = 'RES001'
      const getInspectionsByResidenceIdSpy = jest
        .spyOn(xpandAdapter, 'getInspectionsByResidenceId')
        .mockResolvedValueOnce({ ok: false, err: 'schema-error' })

      const res = await request(app.callback()).get(
        `/inspections/xpand/residence/${residenceId}`
      )

      expect(getInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        residenceId,
        undefined
      )
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'Failed to fetch inspections from Xpand: schema-error'
      )
    })

    it('handles unhandled errors', async () => {
      const residenceId = 'RES001'
      const getInspectionsByResidenceIdSpy = jest
        .spyOn(xpandAdapter, 'getInspectionsByResidenceId')
        .mockImplementation(() => {
          throw new Error('Database connection failed')
        })

      const res = await request(app.callback()).get(
        `/inspections/xpand/residence/${residenceId}`
      )

      expect(getInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        residenceId,
        undefined
      )
      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Database connection failed')
    })
  })

  describe('GET /inspections/xpand/:id', () => {
    it('responds with a detailed inspection', async () => {
      const inspectionId = 'INS001'
      const getInspectionByIdSpy = jest
        .spyOn(xpandAdapter, 'getInspectionById')
        .mockResolvedValueOnce({
          ok: true,
          data: DetailedXpandInspectionFactory.build({
            id: inspectionId,
            status: 'Genomförd',
          }),
        })

      const res = await request(app.callback()).get(
        `/inspections/xpand/${inspectionId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.inspection.id).toBe(inspectionId)
      expect(getInspectionByIdSpy).toHaveBeenCalledWith(inspectionId)
    })

    it('handles not-found errors with 404 status', async () => {
      const inspectionId = 'INS001'
      const getInspectionByIdSpy = jest
        .spyOn(xpandAdapter, 'getInspectionById')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/inspections/xpand/${inspectionId}`
      )

      expect(getInspectionByIdSpy).toHaveBeenCalledWith(inspectionId)
      expect(res.status).toBe(404)
      expect(res.body.error).toBe(
        `Inspection with ID ${inspectionId} not found`
      )
    })

    it('handles other adapter errors with 500 status', async () => {
      const inspectionId = 'INS002'
      const getInspectionByIdSpy = jest
        .spyOn(xpandAdapter, 'getInspectionById')
        .mockResolvedValueOnce({ ok: false, err: 'schema-error' })

      const res = await request(app.callback()).get(
        `/inspections/xpand/${inspectionId}`
      )

      expect(getInspectionByIdSpy).toHaveBeenCalledWith(inspectionId)
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'Failed to fetch inspection from Xpand: schema-error'
      )
    })

    it('handles unhandled errors', async () => {
      const inspectionId = 'INS001'
      const getInspectionByIdSpy = jest
        .spyOn(xpandAdapter, 'getInspectionById')
        .mockImplementation(() => {
          throw new Error('Database connection failed')
        })

      const res = await request(app.callback()).get(
        `/inspections/xpand/${inspectionId}`
      )

      expect(getInspectionByIdSpy).toHaveBeenCalledWith(inspectionId)
      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Database connection failed')
    })
  })

  describe('PATCH /inspections/:inspectionId', () => {
    it('updates inspection status successfully', async () => {
      const inspectionId = '1'
      const mockInspection = DetailedXpandInspectionFactory.build({
        id: inspectionId,
        status: 'Påbörjad',
      })
      const updateSpy = jest
        .spyOn(dbAdapter, 'updateInspectionStatus')
        .mockResolvedValueOnce({ ok: true, data: mockInspection })

      const res = await request(app.callback())
        .patch(`/inspections/${inspectionId}`)
        .send({ status: 'Påbörjad' })

      expect(res.status).toBe(200)
      expect(res.body.content.inspection.id).toBe(inspectionId)
      expect(res.body.content.inspection.status).toBe('Påbörjad')
      expect(updateSpy).toHaveBeenCalled()
    })

    it('returns 400 for invalid request body', async () => {
      const res = await request(app.callback())
        .patch('/inspections/1')
        .send({ status: 'InvalidStatus' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('returns 400 for missing status', async () => {
      const res = await request(app.callback()).patch('/inspections/1').send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
    })

    it('returns 400 for invalid status transition', async () => {
      const inspectionId = '1'
      jest
        .spyOn(dbAdapter, 'updateInspectionStatus')
        .mockResolvedValueOnce({ ok: false, err: 'invalid-status-transition' })

      const res = await request(app.callback())
        .patch(`/inspections/${inspectionId}`)
        .send({ status: 'Genomförd' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid status transition')
    })

    it('returns 404 when inspection not found', async () => {
      const inspectionId = '999'
      jest
        .spyOn(dbAdapter, 'updateInspectionStatus')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .patch(`/inspections/${inspectionId}`)
        .send({ status: 'Påbörjad' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe(
        `Inspection with ID ${inspectionId} not found`
      )
    })

    it('returns 500 on unexpected errors', async () => {
      jest.spyOn(dbAdapter, 'updateInspectionStatus').mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const res = await request(app.callback())
        .patch('/inspections/1')
        .send({ status: 'Påbörjad' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Internal server error')
    })
  })
})
