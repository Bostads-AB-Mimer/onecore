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

  it('returns 500 when property fails on create', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({ ok: false, err: 'upstream_error' })

    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Internal server error')
  })

  it('returns 500 when property fails on update', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'updateComponent')
      .mockResolvedValueOnce({ ok: false, err: 'upstream_error' })

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ condition: 'GOOD' })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Internal server error')
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

describe('POST /processes/add-component', () => {
  const surfaceSubtype = () => ({
    ...factory.componentSubtype.build(),
    componentType: {
      ...factory.componentType.build(),
      category: {
        ...factory.componentCategory.build(),
        type: 'SURFACE' as const,
      },
    },
  })
  const equipmentSubtype = () => ({
    ...factory.componentSubtype.build(),
    componentType: {
      ...factory.componentType.build(),
      category: {
        ...factory.componentCategory.build(),
        type: 'EQUIPMENT' as const,
      },
    },
  })
  const baseRequest = {
    componentSubtypeId: subtypeId,
    spaceId: 'ROOM-1',
    spaceType: 'PropertyObject',
    installationDate: '2026-10-07',
    installationCost: 0,
  }

  it('creates a surface component without a model when no model name is given', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: surfaceSubtype() })
    const find = jest.spyOn(propertyBaseAdapter, 'findModelByExactName')
    const createComponent = jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({
        ok: true,
        data: {
          ...factory.component.build(),
          modelId: null,
          serialNumber: null,
        },
      })
    jest
      .spyOn(propertyBaseAdapter, 'createComponentInstallation')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.componentInstallation.build(),
      })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send({ ...baseRequest, quantity: 14.5, ncsCode: 'S 0502-Y' })

    expect(res.status).toBe(201)
    expect(res.body.content.modelCreated).toBe(false)
    expect(res.body.content.model).toBeNull()
    expect(find).not.toHaveBeenCalled()
    expect(createComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        subtypeId: baseRequest.componentSubtypeId,
        modelId: null,
        serialNumber: null,
        warrantyMonths: null,
        priceAtPurchase: null,
        depreciationPriceAtPurchase: null,
        economicLifespan: null,
        quantity: 14.5,
        ncsCode: 'S 0502-Y',
      })
    )
  })

  it('rejects a model name on a surface subtype', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: surfaceSubtype() })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send({ ...baseRequest, modelName: 'VIT' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('surface-has-model')
  })

  it('looks a model up within the subtype', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: equipmentSubtype() })
    const find = jest
      .spyOn(propertyBaseAdapter, 'findModelByExactName')
      .mockResolvedValueOnce({ ok: true, data: factory.componentModel.build() })
    jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({ ok: true, data: factory.component.build() })
    jest
      .spyOn(propertyBaseAdapter, 'createComponentInstallation')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.componentInstallation.build(),
      })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send({
        ...baseRequest,
        modelName: 'Electrolux ESF5555',
        serialNumber: '4711',
      })

    expect(res.status).toBe(201)
    expect(find).toHaveBeenCalledWith(
      'Electrolux ESF5555',
      baseRequest.componentSubtypeId
    )
  })

  it('maps a property 400 on the component write to 400', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: equipmentSubtype() })
    jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({ ok: false, err: 'bad_request' })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send(baseRequest)

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('component-rejected')
  })

  it('creates the model under the subtype when the name is new', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: equipmentSubtype() })
    jest
      .spyOn(propertyBaseAdapter, 'findModelByExactName')
      .mockResolvedValueOnce({ ok: false, err: 'not_found' })
    const created = factory.componentModel.build()
    const createModel = jest
      .spyOn(propertyBaseAdapter, 'createComponentModel')
      .mockResolvedValueOnce({ ok: true, data: created })
    const createComponent = jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({
        ok: true,
        data: { ...factory.component.build(), modelId: created.id },
      })
    jest
      .spyOn(propertyBaseAdapter, 'createComponentInstallation')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.componentInstallation.build(),
      })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send({
        ...baseRequest,
        modelName: 'Ny modell',
        manufacturer: 'Electrolux',
        currentPrice: 1000,
        currentInstallPrice: 100,
        modelWarrantyMonths: 24,
      })

    expect(res.status).toBe(201)
    expect(res.body.content.modelCreated).toBe(true)
    expect(createModel).toHaveBeenCalledWith(
      expect.objectContaining({
        componentSubtypeId: baseRequest.componentSubtypeId,
      })
    )
    expect(createComponent).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: created.id })
    )
  })

  it('reports the created model when property then rejects the component', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: equipmentSubtype() })
    jest
      .spyOn(propertyBaseAdapter, 'findModelByExactName')
      .mockResolvedValueOnce({ ok: false, err: 'not_found' })
    const created = factory.componentModel.build()
    jest
      .spyOn(propertyBaseAdapter, 'createComponentModel')
      .mockResolvedValueOnce({ ok: true, data: created })
    jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({ ok: false, err: 'bad_request' })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send({
        ...baseRequest,
        modelName: 'Ny modell',
        manufacturer: 'Electrolux',
        currentPrice: 1000,
        currentInstallPrice: 100,
        modelWarrantyMonths: 24,
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('component-rejected')
    expect(res.body.modelCreated).toBe(true)
    expect(res.body.modelId).toBe(created.id)
  })

  it('returns 500 when the model lookup fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: equipmentSubtype() })
    jest
      .spyOn(propertyBaseAdapter, 'findModelByExactName')
      .mockResolvedValueOnce({ ok: false, err: 'upstream_error' })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send({ ...baseRequest, modelName: 'Electrolux ESF5555' })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('internal-error')
  })

  it('creates an appliance without a model when no name is given', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: equipmentSubtype() })
    const find = jest.spyOn(propertyBaseAdapter, 'findModelByExactName')
    const createComponent = jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({
        ok: true,
        data: { ...factory.component.build(), modelId: null },
      })
    jest
      .spyOn(propertyBaseAdapter, 'createComponentInstallation')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.componentInstallation.build(),
      })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send({ ...baseRequest, serialNumber: '4711' })

    expect(res.status).toBe(201)
    expect(find).not.toHaveBeenCalled()
    expect(createComponent).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: null, serialNumber: '4711' })
    )
  })

  it('returns 500 when the subtype cannot be loaded', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: false, err: 'upstream_error' })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send(baseRequest)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('internal-error')
  })

  it('returns 500 when the subtype has no category', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({
        ok: true,
        data: { ...factory.componentSubtype.build(), componentType: undefined },
      })

    const res = await request(app.callback())
      .post('/processes/add-component')
      .send(baseRequest)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('internal-error')
  })

  it('stores an empty serial number as null', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
      .mockResolvedValueOnce({ ok: true, data: equipmentSubtype() })
    const createComponent = jest
      .spyOn(propertyBaseAdapter, 'createComponent')
      .mockResolvedValueOnce({
        ok: true,
        data: {
          ...factory.component.build(),
          modelId: null,
          serialNumber: null,
        },
      })
    jest
      .spyOn(propertyBaseAdapter, 'createComponentInstallation')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.componentInstallation.build(),
      })

    await request(app.callback())
      .post('/processes/add-component')
      .send({ ...baseRequest, serialNumber: '' })

    expect(createComponent).toHaveBeenCalledWith(
      expect.objectContaining({ serialNumber: null })
    )
  })
})

describe('GET /component-subtypes by category type', () => {
  it('forwards categoryType to property', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getComponentSubtypes')
      .mockResolvedValueOnce({
        ok: true,
        data: [factory.componentSubtype.build()],
      })

    const res = await request(app.callback()).get(
      '/component-subtypes?categoryType=SURFACE'
    )

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith(undefined, 1, 20, undefined, 'SURFACE')
  })

  it('rejects an unknown categoryType', async () => {
    const spy = jest.spyOn(propertyBaseAdapter, 'getComponentSubtypes')

    const res = await request(app.callback()).get(
      '/component-subtypes?categoryType=ROOF'
    )

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
})
