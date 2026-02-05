import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { AddComponentErrorCodes } from '@onecore/types'

import { routes } from '../components'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as schemas from '../schemas'
import * as factory from '../../../../test/factories'
import * as addComponentProcess from '../../../processes/components'
import { ProcessStatus } from '../../../common/types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

// ==================== PHASE 2: CATEGORIES, TYPES, SUBTYPES ====================

describe('Component Categories API', () => {
  describe('GET /component-categories', () => {
    it('returns list on success', async () => {
      const categories = factory.componentCategory.buildList(3)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentCategories')
        .mockResolvedValueOnce({ ok: true, data: categories })

      const res = await request(app.callback()).get('/component-categories')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
    })

    it('returns empty array when none exist', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentCategories')
        .mockResolvedValueOnce({ ok: true, data: [] })

      const res = await request(app.callback()).get('/component-categories')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('response matches schema', async () => {
      const categories = factory.componentCategory.buildList(2)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentCategories')
        .mockResolvedValueOnce({ ok: true, data: categories })

      const res = await request(app.callback()).get('/component-categories')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.ComponentCategorySchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 when adapter throws', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentCategories')
        .mockRejectedValue(new Error('Connection failed'))

      const res = await request(app.callback()).get('/component-categories')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /component-categories/:id', () => {
    it('returns category when exists', async () => {
      const category = factory.componentCategory.build()
      jest
        .spyOn(propertyBaseAdapter, 'getComponentCategoryById')
        .mockResolvedValueOnce({ ok: true, data: category })

      const res = await request(app.callback()).get(
        `/component-categories/${category.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.categoryName).toBe(category.categoryName)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentCategoryById')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).get(
        '/component-categories/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })

    it('returns 400 when id is not valid UUID', async () => {
      const res = await request(app.callback()).get(
        '/component-categories/invalid-id'
      )

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid ID format')
    })
  })

  describe('POST /component-categories', () => {
    it('creates and returns category', async () => {
      const category = factory.componentCategory.build()
      jest
        .spyOn(propertyBaseAdapter, 'createComponentCategory')
        .mockResolvedValueOnce({ ok: true, data: category })

      const res = await request(app.callback())
        .post('/component-categories')
        .send({
          categoryName: category.categoryName,
          description: category.description,
        })

      expect(res.status).toBe(200)
      expect(res.body.content.categoryName).toBe(category.categoryName)
    })

    it('returns 400 when required fields missing', async () => {
      const res = await request(app.callback())
        .post('/component-categories')
        .send({})

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /component-categories/:id', () => {
    it('updates and returns category', async () => {
      const category = factory.componentCategory.build({
        categoryName: 'Updated Name',
      })
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentCategory')
        .mockResolvedValueOnce({ ok: true, data: category })

      const res = await request(app.callback())
        .put(`/component-categories/${category.id}`)
        .send({ categoryName: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.content.categoryName).toBe('Updated Name')
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentCategory')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback())
        .put('/component-categories/00000000-0000-0000-0000-000000000001')
        .send({ categoryName: 'Updated Name' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /component-categories/:id', () => {
    it('returns 204 on success', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentCategory')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/component-categories/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentCategory')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).delete(
        '/component-categories/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })
})

describe('Component Types API', () => {
  describe('GET /component-types', () => {
    it('returns list on success', async () => {
      const types = factory.componentType.buildList(3)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentTypes')
        .mockResolvedValueOnce({ ok: true, data: types })

      const res = await request(app.callback()).get('/component-types')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
    })

    it('filters by categoryId', async () => {
      const types = factory.componentType.buildList(2, {
        categoryId: '00000000-0000-0000-0000-000000000001',
      })
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponentTypes')
        .mockResolvedValueOnce({ ok: true, data: types })

      const res = await request(app.callback()).get(
        '/component-types?categoryId=00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        1,
        20
      )
    })

    it('response matches schema', async () => {
      const types = factory.componentType.buildList(2)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentTypes')
        .mockResolvedValueOnce({ ok: true, data: types })

      const res = await request(app.callback()).get('/component-types')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.ComponentTypeSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 when adapter throws', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentTypes')
        .mockRejectedValue(new Error('Connection failed'))

      const res = await request(app.callback()).get('/component-types')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /component-types/:id', () => {
    it('returns type when exists', async () => {
      const type = factory.componentType.build()
      jest
        .spyOn(propertyBaseAdapter, 'getComponentTypeById')
        .mockResolvedValueOnce({ ok: true, data: type })

      const res = await request(app.callback()).get(
        `/component-types/${type.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.typeName).toBe(type.typeName)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentTypeById')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).get(
        '/component-types/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })

  describe('POST /component-types', () => {
    it('creates and returns type', async () => {
      const type = factory.componentType.build()
      jest
        .spyOn(propertyBaseAdapter, 'createComponentType')
        .mockResolvedValueOnce({ ok: true, data: type })

      const res = await request(app.callback()).post('/component-types').send({
        typeName: type.typeName,
        categoryId: type.categoryId,
      })

      expect(res.status).toBe(200)
      expect(res.body.content.typeName).toBe(type.typeName)
    })

    it('returns 400 when categoryId missing', async () => {
      const res = await request(app.callback()).post('/component-types').send({
        typeName: 'Test Type',
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /component-types/:id', () => {
    it('updates and returns type', async () => {
      const type = factory.componentType.build({ typeName: 'Updated Type' })
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentType')
        .mockResolvedValueOnce({ ok: true, data: type })

      const res = await request(app.callback())
        .put(`/component-types/${type.id}`)
        .send({ typeName: 'Updated Type' })

      expect(res.status).toBe(200)
      expect(res.body.content.typeName).toBe('Updated Type')
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentType')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback())
        .put('/component-types/00000000-0000-0000-0000-000000000001')
        .send({ typeName: 'Updated Type' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /component-types/:id', () => {
    it('returns 204 on success', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentType')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/component-types/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentType')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).delete(
        '/component-types/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })
})

describe('Component Subtypes API', () => {
  describe('GET /component-subtypes', () => {
    it('returns list on success', async () => {
      const subtypes = factory.componentSubtype.buildList(3)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypes')
        .mockResolvedValueOnce({ ok: true, data: subtypes })

      const res = await request(app.callback()).get('/component-subtypes')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
    })

    it('filters by typeId', async () => {
      const subtypes = factory.componentSubtype.buildList(2)
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypes')
        .mockResolvedValueOnce({ ok: true, data: subtypes })

      const res = await request(app.callback()).get(
        '/component-subtypes?typeId=00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        1,
        20,
        undefined
      )
    })

    it('filters by subtypeName', async () => {
      const subtypes = factory.componentSubtype.buildList(1, {
        subTypeName: 'Dishwasher',
      })
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypes')
        .mockResolvedValueOnce({ ok: true, data: subtypes })

      const res = await request(app.callback()).get(
        '/component-subtypes?subtypeName=Dishwasher'
      )

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(undefined, 1, 20, 'Dishwasher')
    })

    it('response matches schema', async () => {
      const subtypes = factory.componentSubtype.buildList(2)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypes')
        .mockResolvedValueOnce({ ok: true, data: subtypes })

      const res = await request(app.callback()).get('/component-subtypes')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.ComponentSubtypeSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 when adapter throws', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypes')
        .mockRejectedValue(new Error('Connection failed'))

      const res = await request(app.callback()).get('/component-subtypes')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /component-subtypes/:id', () => {
    it('returns subtype when exists', async () => {
      const subtype = factory.componentSubtype.build()
      jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
        .mockResolvedValueOnce({ ok: true, data: subtype })

      const res = await request(app.callback()).get(
        `/component-subtypes/${subtype.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.subTypeName).toBe(subtype.subTypeName)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypeById')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).get(
        '/component-subtypes/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })

  describe('POST /component-subtypes', () => {
    it('creates and returns subtype', async () => {
      const subtype = factory.componentSubtype.build()
      jest
        .spyOn(propertyBaseAdapter, 'createComponentSubtype')
        .mockResolvedValueOnce({ ok: true, data: subtype })

      const res = await request(app.callback())
        .post('/component-subtypes')
        .send({
          subTypeName: subtype.subTypeName,
          typeId: subtype.typeId,
          quantityType: 'UNIT',
        })

      expect(res.status).toBe(200)
      expect(res.body.content.subTypeName).toBe(subtype.subTypeName)
    })

    it('validates quantityType enum', async () => {
      const res = await request(app.callback())
        .post('/component-subtypes')
        .send({
          subTypeName: 'Test Subtype',
          typeId: '00000000-0000-0000-0000-000000000001',
          quantityType: 'INVALID',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /component-subtypes/:id', () => {
    it('updates and returns subtype', async () => {
      const subtype = factory.componentSubtype.build({
        subTypeName: 'Updated Subtype',
      })
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentSubtype')
        .mockResolvedValueOnce({ ok: true, data: subtype })

      const res = await request(app.callback())
        .put(`/component-subtypes/${subtype.id}`)
        .send({ subTypeName: 'Updated Subtype' })

      expect(res.status).toBe(200)
      expect(res.body.content.subTypeName).toBe('Updated Subtype')
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentSubtype')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback())
        .put('/component-subtypes/00000000-0000-0000-0000-000000000001')
        .send({ subTypeName: 'Updated Subtype' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /component-subtypes/:id', () => {
    it('returns 204 on success', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentSubtype')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/component-subtypes/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentSubtype')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).delete(
        '/component-subtypes/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })
})

// ==================== PHASE 3: MODELS, COMPONENTS, INSTALLATIONS ====================

describe('Component Models API', () => {
  describe('GET /component-models', () => {
    it('returns list on success', async () => {
      const models = factory.componentModel.buildList(3)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentModels')
        .mockResolvedValueOnce({ ok: true, data: models })

      const res = await request(app.callback()).get('/component-models')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
    })

    it('filters by subtypeId', async () => {
      const models = factory.componentModel.buildList(2)
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponentModels')
        .mockResolvedValueOnce({ ok: true, data: models })

      const res = await request(app.callback()).get(
        '/component-models?subtypeId=00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(
        undefined,
        '00000000-0000-0000-0000-000000000001',
        undefined,
        1,
        20,
        undefined
      )
    })

    it('filters by manufacturer', async () => {
      const models = factory.componentModel.buildList(2, {
        manufacturer: 'Bosch',
      })
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponentModels')
        .mockResolvedValueOnce({ ok: true, data: models })

      const res = await request(app.callback()).get(
        '/component-models?manufacturer=Bosch'
      )

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(
        undefined,
        undefined,
        'Bosch',
        1,
        20,
        undefined
      )
    })

    it('response matches schema', async () => {
      const models = factory.componentModel.buildList(2)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentModels')
        .mockResolvedValueOnce({ ok: true, data: models })

      const res = await request(app.callback()).get('/component-models')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.ComponentModelSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 when adapter throws', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentModels')
        .mockRejectedValue(new Error('Connection failed'))

      const res = await request(app.callback()).get('/component-models')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /component-models/:id', () => {
    it('returns model when exists', async () => {
      const model = factory.componentModel.build()
      jest
        .spyOn(propertyBaseAdapter, 'getComponentModelById')
        .mockResolvedValueOnce({ ok: true, data: model })

      const res = await request(app.callback()).get(
        `/component-models/${model.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.modelName).toBe(model.modelName)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentModelById')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).get(
        '/component-models/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })

  describe('POST /component-models', () => {
    it('creates and returns model', async () => {
      const model = factory.componentModel.build()
      jest
        .spyOn(propertyBaseAdapter, 'createComponentModel')
        .mockResolvedValueOnce({ ok: true, data: model })

      const res = await request(app.callback()).post('/component-models').send({
        modelName: model.modelName,
        componentSubtypeId: model.componentSubtypeId,
      })

      expect(res.status).toBe(200)
      expect(res.body.content.modelName).toBe(model.modelName)
    })

    it('returns 400 when required fields missing', async () => {
      const res = await request(app.callback())
        .post('/component-models')
        .send({})

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /component-models/:id', () => {
    it('updates and returns model', async () => {
      const model = factory.componentModel.build({ modelName: 'Updated Model' })
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentModel')
        .mockResolvedValueOnce({ ok: true, data: model })

      const res = await request(app.callback())
        .put(`/component-models/${model.id}`)
        .send({ modelName: 'Updated Model' })

      expect(res.status).toBe(200)
      expect(res.body.content.modelName).toBe('Updated Model')
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentModel')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback())
        .put('/component-models/00000000-0000-0000-0000-000000000001')
        .send({ modelName: 'Updated Model' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /component-models/:id', () => {
    it('returns 204 on success', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentModel')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/component-models/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentModel')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).delete(
        '/component-models/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })

  describe('GET /documents/component-models/:id', () => {
    it('returns list of documents', async () => {
      const documents = [
        {
          id: 'doc-1',
          fileId: 'file-1',
          originalName: 'manual.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          createdAt: new Date().toISOString(),
          url: 'https://example.com/manual.pdf',
        },
      ]
      jest
        .spyOn(propertyBaseAdapter, 'getComponentModelDocuments')
        .mockResolvedValueOnce({ ok: true, data: documents })

      const res = await request(app.callback()).get(
        '/documents/component-models/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })
  })
})

describe('Components API', () => {
  describe('GET /components', () => {
    it('returns list on success', async () => {
      const components = factory.component.buildList(3)
      jest
        .spyOn(propertyBaseAdapter, 'getComponents')
        .mockResolvedValueOnce({ ok: true, data: components })

      const res = await request(app.callback()).get('/components')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
    })

    it('filters by modelId', async () => {
      const components = factory.component.buildList(2)
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponents')
        .mockResolvedValueOnce({ ok: true, data: components })

      const res = await request(app.callback()).get(
        '/components?modelId=00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        undefined,
        1,
        20,
        undefined
      )
    })

    it('filters by status', async () => {
      const components = factory.component.buildList(2, { status: 'ACTIVE' })
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponents')
        .mockResolvedValueOnce({ ok: true, data: components })

      const res = await request(app.callback()).get('/components?status=ACTIVE')

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(undefined, 'ACTIVE', 1, 20, undefined)
    })

    it('response matches schema', async () => {
      const components = factory.component.buildList(2)
      jest
        .spyOn(propertyBaseAdapter, 'getComponents')
        .mockResolvedValueOnce({ ok: true, data: components })

      const res = await request(app.callback()).get('/components')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.ComponentSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 when adapter throws', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponents')
        .mockRejectedValue(new Error('Connection failed'))

      const res = await request(app.callback()).get('/components')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /components/:id', () => {
    it('returns component when exists', async () => {
      const component = factory.component.build()
      jest
        .spyOn(propertyBaseAdapter, 'getComponentById')
        .mockResolvedValueOnce({ ok: true, data: component })

      const res = await request(app.callback()).get(
        `/components/${component.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.serialNumber).toBe(component.serialNumber)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentById')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).get(
        '/components/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })

  describe('GET /components/by-room/:roomId', () => {
    it('returns components for room', async () => {
      const components = factory.component.buildList(2)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentsByRoomId')
        .mockResolvedValueOnce({ ok: true, data: components })

      const res = await request(app.callback()).get(
        '/components/by-room/ROOM-1'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
    })

    it('returns empty array when no components', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentsByRoomId')
        .mockResolvedValueOnce({ ok: true, data: [] })

      const res = await request(app.callback()).get(
        '/components/by-room/ROOM-1'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })
  })

  describe('POST /components', () => {
    it('creates and returns component', async () => {
      const component = factory.component.build()
      jest
        .spyOn(propertyBaseAdapter, 'createComponent')
        .mockResolvedValueOnce({ ok: true, data: component })

      const res = await request(app.callback()).post('/components').send({
        modelId: component.modelId,
      })

      expect(res.status).toBe(200)
      expect(res.body.content.modelId).toBe(component.modelId)
    })

    it('returns 400 when required fields missing', async () => {
      const res = await request(app.callback()).post('/components').send({})

      expect(res.status).toBe(400)
    })

    it('validates status enum', async () => {
      const res = await request(app.callback()).post('/components').send({
        modelId: '00000000-0000-0000-0000-000000000001',
        status: 'INVALID_STATUS',
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /components/:id', () => {
    it('updates and returns component', async () => {
      const component = factory.component.build({ serialNumber: 'SN-UPDATED' })
      jest
        .spyOn(propertyBaseAdapter, 'updateComponent')
        .mockResolvedValueOnce({ ok: true, data: component })

      const res = await request(app.callback())
        .put(`/components/${component.id}`)
        .send({ serialNumber: 'SN-UPDATED' })

      expect(res.status).toBe(200)
      expect(res.body.content.serialNumber).toBe('SN-UPDATED')
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'updateComponent')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback())
        .put('/components/00000000-0000-0000-0000-000000000001')
        .send({ serialNumber: 'SN-UPDATED' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /components/:id', () => {
    it('returns 204 on success', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponent')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/components/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponent')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).delete(
        '/components/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })
})

describe('Component Installations API', () => {
  describe('GET /component-installations', () => {
    it('returns list on success', async () => {
      const installations = factory.componentInstallation.buildList(3)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({ ok: true, data: installations })

      const res = await request(app.callback()).get('/component-installations')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
    })

    it('filters by componentId', async () => {
      const installations = factory.componentInstallation.buildList(2)
      const getSpy = jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({ ok: true, data: installations })

      const res = await request(app.callback()).get(
        '/component-installations?componentId=00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(getSpy).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        undefined,
        undefined,
        1,
        20
      )
    })

    it('response matches schema', async () => {
      const installations = factory.componentInstallation.buildList(2)
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({ ok: true, data: installations })

      const res = await request(app.callback()).get('/component-installations')

      expect(res.status).toBe(200)
      expect(() =>
        schemas.ComponentInstallationSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 when adapter throws', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockRejectedValue(new Error('Connection failed'))

      const res = await request(app.callback()).get('/component-installations')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /component-installations/:id', () => {
    it('returns installation when exists', async () => {
      const installation = factory.componentInstallation.build()
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallationById')
        .mockResolvedValueOnce({ ok: true, data: installation })

      const res = await request(app.callback()).get(
        `/component-installations/${installation.id}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.spaceId).toBe(installation.spaceId)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallationById')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).get(
        '/component-installations/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })

  describe('POST /component-installations', () => {
    it('creates and returns installation', async () => {
      const installation = factory.componentInstallation.build()
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({ ok: true, data: [] })
      jest
        .spyOn(propertyBaseAdapter, 'createComponentInstallation')
        .mockResolvedValueOnce({ ok: true, data: installation })

      const res = await request(app.callback())
        .post('/component-installations')
        .send({
          componentId: installation.componentId,
          spaceType: 'OBJECT',
          installationDate: new Date().toISOString(),
          cost: 3000,
        })

      expect(res.status).toBe(200)
      expect(res.body.content.componentId).toBe(installation.componentId)
    })

    it('validates spaceType enum', async () => {
      const res = await request(app.callback())
        .post('/component-installations')
        .send({
          componentId: '00000000-0000-0000-0000-000000000001',
          spaceType: 'INVALID',
          installationDate: new Date().toISOString(),
          cost: 3000,
        })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /component-installations/:id', () => {
    it('updates and returns installation', async () => {
      const installation = factory.componentInstallation.build({
        cost: 5000,
      })
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentInstallation')
        .mockResolvedValueOnce({ ok: true, data: installation })

      const res = await request(app.callback())
        .put(`/component-installations/${installation.id}`)
        .send({ cost: 5000 })

      expect(res.status).toBe(200)
      expect(res.body.content.cost).toBe(5000)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'updateComponentInstallation')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback())
        .put('/component-installations/00000000-0000-0000-0000-000000000001')
        .send({ cost: 5000 })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /component-installations/:id', () => {
    it('returns 204 on success', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentInstallation')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/component-installations/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentInstallation')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).delete(
        '/component-installations/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })
})

// ==================== PHASE 4: FILE UPLOADS ====================

describe('Component File Uploads', () => {
  describe('POST /components/:id/upload', () => {
    it('uploads file successfully', async () => {
      const document = {
        id: 'doc-1',
        fileId: 'file-1',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        createdAt: new Date().toISOString(),
        url: 'https://example.com/photo.jpg',
      }
      jest
        .spyOn(propertyBaseAdapter, 'uploadComponentFile')
        .mockResolvedValueOnce({ ok: true, data: document })

      const res = await request(app.callback())
        .post('/components/00000000-0000-0000-0000-000000000001/upload')
        .send({
          fileData: 'base64data',
          fileName: 'photo.jpg',
          contentType: 'image/jpeg',
        })

      expect(res.status).toBe(200)
      expect(res.body.content.originalName).toBe('photo.jpg')
    })

    it('returns 400 when required fields missing', async () => {
      const res = await request(app.callback())
        .post('/components/00000000-0000-0000-0000-000000000001/upload')
        .send({})

      expect(res.status).toBe(400)
    })

    it('returns 500 when upload fails', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'uploadComponentFile')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/components/00000000-0000-0000-0000-000000000001/upload')
        .send({
          fileData: 'base64data',
          fileName: 'photo.jpg',
          contentType: 'image/jpeg',
        })

      expect(res.status).toBe(500)
    })
  })

  describe('GET /documents/component-instances/:id', () => {
    it('returns list of documents', async () => {
      const documents = [
        {
          id: 'doc-1',
          fileId: 'file-1',
          originalName: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          createdAt: new Date().toISOString(),
          url: 'https://example.com/photo.jpg',
        },
      ]
      jest
        .spyOn(propertyBaseAdapter, 'getComponentFiles')
        .mockResolvedValueOnce({ ok: true, data: documents })

      const res = await request(app.callback()).get(
        '/documents/component-instances/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })

    it('returns empty array when no documents', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentFiles')
        .mockResolvedValueOnce({ ok: true, data: [] })

      const res = await request(app.callback()).get(
        '/documents/component-instances/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })
  })

  describe('DELETE /documents/:id', () => {
    it('returns 204 on success', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentFile')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/documents/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })

    it('returns 404 when document not found', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponentFile')
        .mockResolvedValueOnce({ ok: false, err: 'not_found' })

      const res = await request(app.callback()).delete(
        '/documents/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(404)
    })
  })
})

describe('Component Model Documents', () => {
  describe('POST /component-models/:id/upload', () => {
    it('uploads document successfully', async () => {
      const document = {
        id: 'doc-1',
        fileId: 'file-1',
        originalName: 'manual.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        createdAt: new Date().toISOString(),
        url: 'https://example.com/manual.pdf',
      }
      jest
        .spyOn(propertyBaseAdapter, 'uploadComponentModelDocument')
        .mockResolvedValueOnce({ ok: true, data: document })

      const res = await request(app.callback())
        .post('/component-models/00000000-0000-0000-0000-000000000001/upload')
        .send({
          fileData: 'base64data',
          fileName: 'manual.pdf',
          contentType: 'application/pdf',
        })

      expect(res.status).toBe(200)
      expect(res.body.content.originalName).toBe('manual.pdf')
    })

    it('returns 400 when required fields missing', async () => {
      const res = await request(app.callback())
        .post('/component-models/00000000-0000-0000-0000-000000000001/upload')
        .send({})

      expect(res.status).toBe(400)
    })
  })
})

// ==================== PHASE 5: AI ANALYSIS ====================

describe('POST /components/analyze-image', () => {
  it('analyzes image successfully with confidence score', async () => {
    const analysis = {
      componentCategory: 'Kitchen',
      componentType: 'Dishwasher',
      componentSubtype: 'Built-in dishwasher',
      manufacturer: 'Bosch',
      model: 'SMS68TI02E',
      serialNumber: 'BSH-123456',
      estimatedAge: '2-3 years',
      condition: 'GOOD',
      specifications: 'Standard built-in dishwasher',
      dimensions: '60x60x85 cm',
      warrantyMonths: 24,
      ncsCode: null,
      additionalInformation: null,
      confidence: 0.85,
    }
    jest
      .spyOn(propertyBaseAdapter, 'analyzeComponentImage')
      .mockResolvedValueOnce({ ok: true, data: analysis })

    const res = await request(app.callback())
      .post('/components/analyze-image')
      .send({ image: 'base64imagedata' })

    expect(res.status).toBe(200)
    expect(res.body.content.confidence).toBe(0.85)
    expect(res.body.content.manufacturer).toBe('Bosch')
  })

  it('returns 400 when image missing', async () => {
    const res = await request(app.callback())
      .post('/components/analyze-image')
      .send({})

    expect(res.status).toBe(400)
  })

  it('handles additionalImage parameter', async () => {
    const analysis = {
      componentCategory: null,
      componentType: 'Dishwasher',
      componentSubtype: null,
      manufacturer: 'Bosch',
      model: null,
      serialNumber: 'BSH-123456',
      estimatedAge: null,
      condition: 'GOOD',
      specifications: null,
      dimensions: null,
      warrantyMonths: null,
      ncsCode: null,
      additionalInformation: null,
      confidence: 0.9,
    }
    const analyzeSpy = jest
      .spyOn(propertyBaseAdapter, 'analyzeComponentImage')
      .mockResolvedValueOnce({ ok: true, data: analysis })

    const res = await request(app.callback())
      .post('/components/analyze-image')
      .send({
        image: 'base64imagedata',
        additionalImage: 'base64additionaldata',
      })

    expect(res.status).toBe(200)
    expect(analyzeSpy).toHaveBeenCalledWith({
      image: 'base64imagedata',
      additionalImage: 'base64additionaldata',
    })
  })

  it('returns 500 when analysis fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'analyzeComponentImage')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback())
      .post('/components/analyze-image')
      .send({ image: 'base64imagedata' })

    expect(res.status).toBe(500)
  })
})

// ==================== PHASE 6: ADD COMPONENT PROCESS ====================

describe('POST /processes/add-component', () => {
  const validRequest = {
    modelName: 'Bosch SMS68TI02E',
    componentSubtypeId: '00000000-0000-0000-0000-000000000001',
    manufacturer: 'Bosch',
    currentPrice: 8500,
    currentInstallPrice: 1500,
    modelWarrantyMonths: 24,
    serialNumber: 'BSH-123456',
    componentWarrantyMonths: 24,
    priceAtPurchase: 8500,
    depreciationPriceAtPurchase: 5000,
    economicLifespan: 10,
    spaceId: 'ROOM-001',
    spaceType: 'OBJECT',
    installationDate: '2024-01-15',
    installationCost: 1500,
  }

  describe('successful scenarios', () => {
    it('creates component with NEW model (modelCreated: true)', async () => {
      const processResult = {
        processStatus: ProcessStatus.successful as const,
        httpStatus: 201,
        data: {
          modelCreated: true,
          model: {
            id: '00000000-0000-0000-0000-000000000002',
            modelName: 'Bosch SMS68TI02E',
            manufacturer: 'Bosch',
          },
          component: {
            id: '00000000-0000-0000-0000-000000000003',
            serialNumber: 'BSH-123456',
            status: 'ACTIVE',
          },
          installation: {
            id: '00000000-0000-0000-0000-000000000004',
            spaceId: 'ROOM-001',
            installationDate: '2024-01-15',
          },
        },
        response: {
          message: 'Component added successfully with new model.',
        },
      }
      jest
        .spyOn(addComponentProcess, 'addComponent')
        .mockResolvedValueOnce(processResult)

      const res = await request(app.callback())
        .post('/processes/add-component')
        .send(validRequest)

      expect(res.status).toBe(201)
      expect(res.body.content.modelCreated).toBe(true)
    })

    it('creates component with EXISTING model (modelCreated: false)', async () => {
      const processResult = {
        processStatus: ProcessStatus.successful as const,
        httpStatus: 201,
        data: {
          modelCreated: false,
          model: {
            id: '00000000-0000-0000-0000-000000000002',
            modelName: 'Bosch SMS68TI02E',
            manufacturer: 'Bosch',
          },
          component: {
            id: '00000000-0000-0000-0000-000000000003',
            serialNumber: 'BSH-123456',
            status: 'ACTIVE',
          },
          installation: {
            id: '00000000-0000-0000-0000-000000000004',
            spaceId: 'ROOM-001',
            installationDate: '2024-01-15',
          },
        },
        response: {
          message: 'Component added successfully using existing model.',
        },
      }
      jest
        .spyOn(addComponentProcess, 'addComponent')
        .mockResolvedValueOnce(processResult)

      const res = await request(app.callback())
        .post('/processes/add-component')
        .send(validRequest)

      expect(res.status).toBe(201)
      expect(res.body.content.modelCreated).toBe(false)
    })
  })

  describe('error scenarios', () => {
    it('returns 400 SubtypeNotFound when subtype does not exist', async () => {
      const processResult = {
        processStatus: ProcessStatus.failed as const,
        error: AddComponentErrorCodes.SubtypeNotFound,
        httpStatus: 400,
        response: {
          message: 'Component subtype not found.',
        },
      }
      jest
        .spyOn(addComponentProcess, 'addComponent')
        .mockResolvedValueOnce(processResult)

      const res = await request(app.callback())
        .post('/processes/add-component')
        .send(validRequest)

      expect(res.status).toBe(400)
    })

    it('returns 400 MissingModelFields when model not found AND missing required fields', async () => {
      const processResult = {
        processStatus: ProcessStatus.failed as const,
        error: AddComponentErrorCodes.MissingModelFields,
        httpStatus: 400,
        response: {
          message:
            'Model does not exist. The following fields are required to create it: manufacturer, currentPrice',
          missingFields: ['manufacturer', 'currentPrice'],
        },
      }
      jest
        .spyOn(addComponentProcess, 'addComponent')
        .mockResolvedValueOnce(processResult)

      const requestWithoutModelFields = {
        ...validRequest,
        manufacturer: undefined,
        currentPrice: undefined,
      }

      const res = await request(app.callback())
        .post('/processes/add-component')
        .send(requestWithoutModelFields)

      expect(res.status).toBe(400)
    })

    it('returns 500 ModelCreationFailed when model creation fails', async () => {
      const processResult = {
        processStatus: ProcessStatus.failed as const,
        error: AddComponentErrorCodes.ModelCreationFailed,
        httpStatus: 500,
        response: {
          message: 'Failed to create component model.',
        },
      }
      jest
        .spyOn(addComponentProcess, 'addComponent')
        .mockResolvedValueOnce(processResult)

      const res = await request(app.callback())
        .post('/processes/add-component')
        .send(validRequest)

      expect(res.status).toBe(500)
    })

    it('returns 500 ComponentCreationFailed when component creation fails', async () => {
      const processResult = {
        processStatus: ProcessStatus.failed as const,
        error: AddComponentErrorCodes.ComponentCreationFailed,
        httpStatus: 500,
        response: {
          message: 'Failed to create component instance.',
        },
      }
      jest
        .spyOn(addComponentProcess, 'addComponent')
        .mockResolvedValueOnce(processResult)

      const res = await request(app.callback())
        .post('/processes/add-component')
        .send(validRequest)

      expect(res.status).toBe(500)
    })

    it('returns 500 InstallationCreationFailed when installation fails', async () => {
      const processResult = {
        processStatus: ProcessStatus.failed as const,
        error: AddComponentErrorCodes.InstallationCreationFailed,
        httpStatus: 500,
        response: {
          message:
            'Failed to create installation. Component has been cleaned up.',
        },
      }
      jest
        .spyOn(addComponentProcess, 'addComponent')
        .mockResolvedValueOnce(processResult)

      const res = await request(app.callback())
        .post('/processes/add-component')
        .send(validRequest)

      expect(res.status).toBe(500)
    })
  })

  describe('validation', () => {
    it('returns 400 when required fields missing', async () => {
      const res = await request(app.callback())
        .post('/processes/add-component')
        .send({})

      expect(res.status).toBe(400)
    })

    it('returns 400 when spaceType is invalid enum', async () => {
      const res = await request(app.callback())
        .post('/processes/add-component')
        .send({
          ...validRequest,
          spaceType: 'INVALID',
        })

      expect(res.status).toBe(400)
    })
  })
})

// ==================== PHASE 6: CASCADE DELETE PREVENTION ====================

describe('Cascade Delete Prevention', () => {
  describe('DELETE /component-categories/:id', () => {
    it('returns 409 when category has child types', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentTypes')
        .mockResolvedValueOnce({
          ok: true,
          data: [factory.componentType.build()],
        })

      const res = await request(app.callback()).delete(
        '/component-categories/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('har 1 typer')
    })
  })

  describe('DELETE /component-types/:id', () => {
    it('returns 409 when type has child subtypes', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentSubtypes')
        .mockResolvedValueOnce({
          ok: true,
          data: [factory.componentSubtype.build()],
        })

      const res = await request(app.callback()).delete(
        '/component-types/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('har 1 undertyper')
    })
  })

  describe('DELETE /component-subtypes/:id', () => {
    it('returns 409 when subtype has child models', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentModels')
        .mockResolvedValueOnce({
          ok: true,
          data: [factory.componentModel.build()],
        })

      const res = await request(app.callback()).delete(
        '/component-subtypes/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('har 1 modeller')
    })
  })

  describe('DELETE /component-models/:id', () => {
    it('returns 409 when model has child components', async () => {
      jest.spyOn(propertyBaseAdapter, 'getComponents').mockResolvedValueOnce({
        ok: true,
        data: [factory.component.build()],
      })

      const res = await request(app.callback()).delete(
        '/component-models/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('har 1 komponenter')
    })
  })

  describe('DELETE /components/:id', () => {
    it('returns 409 when component has active installation', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({
          ok: true,
          data: [
            factory.componentInstallation.build({ deinstallationDate: null }),
          ],
        })

      const res = await request(app.callback()).delete(
        '/components/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('är installerad')
    })

    it('allows delete when all installations are deinstalled', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({
          ok: true,
          data: [
            factory.componentInstallation.build({
              deinstallationDate: '2023-12-01',
            }),
          ],
        })
      jest
        .spyOn(propertyBaseAdapter, 'deleteComponent')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback()).delete(
        '/components/00000000-0000-0000-0000-000000000001'
      )

      expect(res.status).toBe(204)
    })
  })
})

// ==================== PHASE 7: INSTALLATION UNIQUENESS ====================

describe('Installation Uniqueness', () => {
  describe('POST /component-installations', () => {
    it('returns 409 when component already has active installation', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({
          ok: true,
          data: [
            factory.componentInstallation.build({ deinstallationDate: null }),
          ],
        })

      const res = await request(app.callback())
        .post('/component-installations')
        .send({
          componentId: '00000000-0000-0000-0000-000000000001',
          spaceType: 'OBJECT',
          installationDate: '2024-01-01',
          cost: 1000,
        })

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('aktiv installation')
    })

    it('allows installation after previous is deinstalled', async () => {
      jest
        .spyOn(propertyBaseAdapter, 'getComponentInstallations')
        .mockResolvedValueOnce({
          ok: true,
          data: [
            factory.componentInstallation.build({
              deinstallationDate: '2023-12-01',
            }),
          ],
        })
      jest
        .spyOn(propertyBaseAdapter, 'createComponentInstallation')
        .mockResolvedValueOnce({
          ok: true,
          data: factory.componentInstallation.build(),
        })

      const res = await request(app.callback())
        .post('/component-installations')
        .send({
          componentId: '00000000-0000-0000-0000-000000000001',
          spaceType: 'OBJECT',
          installationDate: '2024-01-01',
          cost: 1000,
        })

      expect(res.status).toBe(200)
    })
  })
})
