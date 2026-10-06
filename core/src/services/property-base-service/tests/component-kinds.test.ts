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

describe('Component category type', () => {
  it('returns the category type', async () => {
    const category = { ...factory.componentCategory.build(), type: 'SURFACE' }
    jest
      .spyOn(propertyBaseAdapter, 'getComponentCategories')
      .mockResolvedValueOnce({ ok: true, data: [category] })

    const res = await request(app.callback()).get('/component-categories')

    expect(res.status).toBe(200)
    expect(res.body.content[0].type).toBe('SURFACE')
  })

  it('forwards the type when creating a category', async () => {
    const category = { ...factory.componentCategory.build(), type: 'SURFACE' }
    const create = jest
      .spyOn(propertyBaseAdapter, 'createComponentCategory')
      .mockResolvedValueOnce({ ok: true, data: category })

    const res = await request(app.callback())
      .post('/component-categories')
      .send({
        categoryName: 'Ytskikt',
        description: 'Golv, väggar och tak',
        type: 'SURFACE',
      })

    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SURFACE' })
    )
  })

  it('rejects an unknown category type', async () => {
    const res = await request(app.callback())
      .post('/component-categories')
      .send({
        categoryName: 'Möbler',
        description: 'Lösa möbler',
        type: 'FURNITURE',
      })

    expect(res.status).toBe(400)
  })
})

describe('Component type code', () => {
  it('returns the type code', async () => {
    const type = { ...factory.componentType.build(), code: 'WALL' }
    jest
      .spyOn(propertyBaseAdapter, 'getComponentTypes')
      .mockResolvedValueOnce({ ok: true, data: [type] })

    const res = await request(app.callback()).get('/component-types')

    expect(res.status).toBe(200)
    expect(res.body.content[0].code).toBe('WALL')
  })

  it('forwards the code when creating a type', async () => {
    const type = { ...factory.componentType.build(), code: 'FLOOR' }
    const create = jest
      .spyOn(propertyBaseAdapter, 'createComponentType')
      .mockResolvedValueOnce({ ok: true, data: type })

    const res = await request(app.callback()).post('/component-types').send({
      typeName: 'Golv',
      categoryId: type.categoryId,
      code: 'FLOOR',
    })

    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FLOOR' })
    )
  })

  it('rejects an unknown type code', async () => {
    const res = await request(app.callback()).post('/component-types').send({
      typeName: 'Yttertak',
      categoryId: '00000000-0000-0000-0000-000000000001',
      code: 'ROOF',
    })

    expect(res.status).toBe(400)
  })
})

describe('Component hierarchy', () => {
  it('carries category type and type code through to a component', async () => {
    const category = { ...factory.componentCategory.build(), type: 'SURFACE' }
    const componentType = {
      ...factory.componentType.build(),
      code: 'WALL',
      category,
    }
    const subtype = { ...factory.componentSubtype.build(), componentType }
    const model = { ...factory.componentModel.build(), subtype }
    const component = { ...factory.component.build(), model }
    jest
      .spyOn(propertyBaseAdapter, 'getComponentById')
      .mockResolvedValueOnce({ ok: true, data: component })

    const res = await request(app.callback()).get(
      `/components/${component.id}`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.model.subtype.componentType.code).toBe('WALL')
    expect(res.body.content.model.subtype.componentType.category.type).toBe(
      'SURFACE'
    )
  })
})
