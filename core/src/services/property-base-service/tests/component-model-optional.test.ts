import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../components'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as factory from '../../../../test/factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

const subtypeId = '00000000-0000-0000-0002-000000000001'
const modelId = '00000000-0000-0000-0003-000000000001'
const componentId = '00000000-0000-0000-0004-000000000001'

describe('Components without a model', () => {
  it('creates a surface component with only a subtype', async () => {
    const wall = {
      ...factory.component.build(),
      subtypeId,
      modelId: null,
      warrantyMonths: null,
      priceAtPurchase: null,
      depreciationPriceAtPurchase: null,
      economicLifespan: null,
    }
    const create = jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({ ok: true, data: wall })

    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId, quantity: 14.5, ncsCode: 'S 0502-Y' })

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      subtypeId,
      modelId: null,
      warrantyMonths: null,
      priceAtPurchase: null,
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        subtypeId,
        quantity: 14.5,
        ncsCode: 'S 0502-Y',
      })
    )
    const [sent] = create.mock.calls[0]
    expect(sent).not.toHaveProperty('warrantyMonths')
  })

  it('forwards null numerics on update', async () => {
    const wall = {
      ...factory.component.build(),
      id: componentId,
      subtypeId,
      modelId: null,
      priceAtPurchase: null,
    }
    const update = jest
      .spyOn(propertyBaseAdapter, 'updateComponent')
      .mockResolvedValueOnce({ ok: true, data: wall })

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ priceAtPurchase: null })

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      componentId,
      expect.objectContaining({ priceAtPurchase: null })
    )
  })

  it('rejects an ncsCode longer than 15 characters', async () => {
    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId, ncsCode: 'NCS S 1050-Y90R x' })

    expect(res.status).toBe(400)
  })

  it('rejects a create without subtypeId', async () => {
    const res = await request(app.callback())
      .post('/components')
      .send({ modelId })

    expect(res.status).toBe(400)
  })

  it('returns 400 when property rejects the model for the subtype on create', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({ ok: false, err: 'bad_request' })

    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId, modelId })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/SURFACE|subtype/)
  })

  it('returns 400 when property rejects the model on update', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'updateComponent')
      .mockResolvedValueOnce({ ok: false, err: 'bad_request' })

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ modelId })

    expect(res.status).toBe(400)
  })

  it('still returns 404 for an unknown component on update', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'updateComponent')
      .mockResolvedValueOnce({ ok: false, err: 'not_found' })

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ condition: 'GOOD' })

    expect(res.status).toBe(404)
  })

  it('reads a component with a subtype and no model', async () => {
    const wall = {
      ...factory.component.build(),
      subtypeId,
      modelId: null,
      subtype: factory.componentSubtype.build(),
    }
    jest
      .spyOn(propertyBaseAdapter, 'getComponentById')
      .mockResolvedValueOnce({ ok: true, data: wall })

    const res = await request(app.callback()).get(`/components/${wall.id}`)

    expect(res.status).toBe(200)
    expect(res.body.content.subtypeId).toBe(subtypeId)
    expect(res.body.content.subtype.id).toBe(wall.subtype.id)
  })
})
