import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { z } from 'zod'

import { routes } from '../index'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'

import * as factory from '../../../../test/factories'
import { PropertySchema, ResidenceSchema, StaircaseSchema } from '../schemas'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('property-base-service', () => {
  describe('GET /propertyBase/properties', () => {
    it('returns 200 and a list of properties', async () => {
      const propertiesMock = factory.property.buildList(3)
      const getPropertiesSpy = jest
        .spyOn(propertyBaseAdapter, 'getProperties')
        .mockResolvedValueOnce({ ok: true, data: propertiesMock })

      const res = await request(app.callback()).get(
        `/propertyBase/properties?companyCode=123`
      )

      expect(res.status).toBe(200)
      expect(getPropertiesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(propertiesMock)
      )
      expect(() =>
        z.array(PropertySchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 if company code is missing', async () => {
      const res = await request(app.callback()).get(`/propertyBase/properties`)

      expect(res.status).toBe(400)
    })
  })

  describe('GET /propertyBase/residences', () => {
    it('returns 200 and a list of residences', async () => {
      const residences = factory.residenceDetails.buildList(3)
      const getResidencesSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidences')
        .mockResolvedValueOnce({ ok: true, data: residences })
      const res = await request(app.callback()).get(
        `/propertyBase/residences?buildingCode=202-002`
      )

      expect(res.status).toBe(200)
      expect(getResidencesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(residences)
      )
      expect(() =>
        z.array(ResidenceSchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 if building code is missing', async () => {
      const res = await request(app.callback()).get(`/propertyBase/residences`)

      expect(res.status).toBe(400)
    })
  })

  describe('GET /propertyBase/residence/:residenceId', () => {
    it('returns 200 and a residence', async () => {
      const residenceDetails = factory.residenceDetails.build()
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceDetails')
        .mockResolvedValueOnce({ ok: true, data: residenceDetails })

      const res = await request(app.callback()).get(
        `/propertyBase/residence/${residenceDetails.id}`
      )

      expect(res.status).toBe(200)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(residenceDetails)
      )
      expect(() => ResidenceSchema.parse(res.body.content)).not.toThrow()
    })

    it('returns 404 if no residence is found', async () => {
      const residence = factory.residence.build()
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceDetails')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/propertyBase/residence/${residence.id}`
      )

      expect(res.status).toBe(404)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
    })
  })

  describe('GET /propertyBase/staircases', () => {
    it('returns 200 and a list of staircases', async () => {
      const staircasesMock = factory.staircase.buildList(3)
      const getStaircasesSpy = jest
        .spyOn(propertyBaseAdapter, 'getStaircases')
        .mockResolvedValueOnce({ ok: true, data: staircasesMock })

      const res = await request(app.callback()).get(
        '/propertyBase/staircases?buildingCode=002-002'
      )

      expect(res.status).toBe(200)
      expect(getStaircasesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(staircasesMock)
      )
      expect(() =>
        z.array(StaircaseSchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 if buildingCode query parameter is missing', async () => {
      const res = await request(app.callback()).get('/propertyBase/staircases')

      expect(res.status).toBe(400)
    })
  })
})
