jest.mock('../adapters/db', () => ({
  prisma: {
    componentCategories: { findUnique: jest.fn(), update: jest.fn() },
    componentTypes: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    componentSubtypes: { findUnique: jest.fn(), update: jest.fn() },
    componentModels: { count: jest.fn() },
  },
}))

import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import request from 'supertest'
import { prisma } from '../adapters/db'
import { routes as categoryRoutes } from '../routes/component-categories'
import { routes as typeRoutes } from '../routes/component-types'
import { routes as subtypeRoutes } from '../routes/component-subtypes'

const app = new Koa()
const router = new KoaRouter()
categoryRoutes(router)
typeRoutes(router)
subtypeRoutes(router)
app.use(bodyParser())
app.use(router.routes())

const timestamps = {
  createdAt: new Date('2026-10-09T00:00:00.000Z'),
  updatedAt: new Date('2026-10-09T00:00:00.000Z'),
}
const categoryId = '00000000-0000-0000-0001-000000000001'
const surfaceCategoryId = '00000000-0000-0000-0001-000000000002'
const typeId = '00000000-0000-0000-0002-000000000001'
const surfaceTypeId = '00000000-0000-0000-0002-000000000002'
const subtypeId = '00000000-0000-0000-0003-000000000001'

const equipmentCategory = {
  id: categoryId,
  categoryName: 'Vitvaror',
  description: 'Vitvaror',
  type: 'EQUIPMENT',
  componentTypes: [],
  ...timestamps,
}
const applianceType = {
  id: typeId,
  typeName: 'Spis',
  categoryId,
  description: null,
  code: null,
  category: equipmentCategory,
  componentSubtypes: [],
  ...timestamps,
}
const applianceSubtype = {
  id: subtypeId,
  subTypeName: 'Spis 60 cm',
  typeId,
  xpandCode: null,
  depreciationPrice: 0,
  technicalLifespan: 0,
  economicLifespan: 0,
  replacementIntervalMonths: 0,
  quantityType: 'UNIT',
  componentType: applianceType,
  componentModels: [],
  ...timestamps,
}

const mocked = prisma as unknown as {
  componentCategories: { findUnique: jest.Mock; update: jest.Mock }
  componentTypes: {
    findUnique: jest.Mock
    findFirst: jest.Mock
    update: jest.Mock
  }
  componentSubtypes: { findUnique: jest.Mock; update: jest.Mock }
  componentModels: { count: jest.Mock }
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('PUT /component-categories/:id into SURFACE', () => {
  beforeEach(() => {
    mocked.componentCategories.findUnique.mockResolvedValue(equipmentCategory)
    mocked.componentCategories.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...equipmentCategory,
        ...data,
      })
    )
  })

  it('returns 409 and does not update when models exist under the category', async () => {
    mocked.componentModels.count.mockResolvedValue(3)

    const res = await request(app.callback())
      .put(`/component-categories/${categoryId}`)
      .send({ type: 'SURFACE' })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/3 models/)
    expect(mocked.componentModels.count).toHaveBeenCalledWith({
      where: { subtype: { componentType: { categoryId } } },
    })
    expect(mocked.componentCategories.update).not.toHaveBeenCalled()
  })

  it('updates when no models exist under the category', async () => {
    mocked.componentModels.count.mockResolvedValue(0)

    const res = await request(app.callback())
      .put(`/component-categories/${categoryId}`)
      .send({ type: 'SURFACE' })

    expect(res.status).toBe(200)
    expect(res.body.content.type).toBe('SURFACE')
  })

  it('does not count models when the type is not in the request', async () => {
    const res = await request(app.callback())
      .put(`/component-categories/${categoryId}`)
      .send({ categoryName: 'Vitvaror 2' })

    expect(res.status).toBe(200)
    expect(mocked.componentModels.count).not.toHaveBeenCalled()
  })

  it('does not count models when the category is SURFACE already', async () => {
    mocked.componentCategories.findUnique.mockResolvedValue({
      ...equipmentCategory,
      type: 'SURFACE',
    })

    const res = await request(app.callback())
      .put(`/component-categories/${categoryId}`)
      .send({ type: 'SURFACE' })

    expect(res.status).toBe(200)
    expect(mocked.componentModels.count).not.toHaveBeenCalled()
  })
})

describe('PUT /component-types/:id into a SURFACE category', () => {
  beforeEach(() => {
    mocked.componentTypes.findUnique.mockResolvedValue(applianceType)
    mocked.componentTypes.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...applianceType,
        ...data,
      })
    )
  })

  it('returns 409 and does not update when the type has models under it', async () => {
    mocked.componentCategories.findUnique.mockResolvedValue({
      ...equipmentCategory,
      id: surfaceCategoryId,
      type: 'SURFACE',
    })
    mocked.componentModels.count.mockResolvedValue(12)

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ categoryId: surfaceCategoryId })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/12 models/)
    expect(mocked.componentModels.count).toHaveBeenCalledWith({
      where: { subtype: { typeId } },
    })
    expect(mocked.componentTypes.update).not.toHaveBeenCalled()
  })

  it('updates when the type has no models', async () => {
    mocked.componentCategories.findUnique.mockResolvedValue({
      ...equipmentCategory,
      id: surfaceCategoryId,
      type: 'SURFACE',
    })
    mocked.componentModels.count.mockResolvedValue(0)

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ categoryId: surfaceCategoryId })

    expect(res.status).toBe(200)
    expect(res.body.content.categoryId).toBe(surfaceCategoryId)
  })

  it('does not count models when the target category is EQUIPMENT', async () => {
    mocked.componentCategories.findUnique.mockResolvedValue({
      ...equipmentCategory,
      id: surfaceCategoryId,
    })

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ categoryId: surfaceCategoryId })

    expect(res.status).toBe(200)
    expect(mocked.componentModels.count).not.toHaveBeenCalled()
  })

  it('does not look at the category when categoryId is unchanged', async () => {
    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ categoryId, typeName: 'Spisar' })

    expect(res.status).toBe(200)
    expect(mocked.componentCategories.findUnique).not.toHaveBeenCalled()
    expect(mocked.componentModels.count).not.toHaveBeenCalled()
  })

  it('returns 400 when the target category does not exist', async () => {
    mocked.componentCategories.findUnique.mockResolvedValue(null)

    const res = await request(app.callback())
      .put(`/component-types/${typeId}`)
      .send({ categoryId: surfaceCategoryId })

    expect(res.status).toBe(400)
    expect(mocked.componentTypes.update).not.toHaveBeenCalled()
  })
})

describe('PUT /component-subtypes/:id under a type in a SURFACE category', () => {
  const surfaceType = {
    ...applianceType,
    id: surfaceTypeId,
    typeName: 'Vägg',
    categoryId: surfaceCategoryId,
    code: 'WALL',
    category: { ...equipmentCategory, id: surfaceCategoryId, type: 'SURFACE' },
  }

  beforeEach(() => {
    mocked.componentSubtypes.findUnique.mockResolvedValue(applianceSubtype)
    mocked.componentSubtypes.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...applianceSubtype,
        ...data,
      })
    )
  })

  it('returns 409 and does not update when the subtype has models', async () => {
    mocked.componentTypes.findUnique.mockResolvedValue(surfaceType)
    mocked.componentModels.count.mockResolvedValue(5)

    const res = await request(app.callback())
      .put(`/component-subtypes/${subtypeId}`)
      .send({ typeId: surfaceTypeId })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/5 models/)
    expect(mocked.componentModels.count).toHaveBeenCalledWith({
      where: { componentSubtypeId: subtypeId },
    })
    expect(mocked.componentSubtypes.update).not.toHaveBeenCalled()
  })

  it('updates when the subtype has no models', async () => {
    mocked.componentTypes.findUnique.mockResolvedValue(surfaceType)
    mocked.componentModels.count.mockResolvedValue(0)

    const res = await request(app.callback())
      .put(`/component-subtypes/${subtypeId}`)
      .send({ typeId: surfaceTypeId })

    expect(res.status).toBe(200)
    expect(res.body.content.typeId).toBe(surfaceTypeId)
  })

  it('does not count models when the target type is in an EQUIPMENT category', async () => {
    mocked.componentTypes.findUnique.mockResolvedValue({
      ...applianceType,
      id: surfaceTypeId,
    })

    const res = await request(app.callback())
      .put(`/component-subtypes/${subtypeId}`)
      .send({ typeId: surfaceTypeId })

    expect(res.status).toBe(200)
    expect(mocked.componentModels.count).not.toHaveBeenCalled()
  })

  it('does not look at the type when typeId is unchanged', async () => {
    const res = await request(app.callback())
      .put(`/component-subtypes/${subtypeId}`)
      .send({ typeId, subTypeName: 'Spis 90 cm' })

    expect(res.status).toBe(200)
    expect(mocked.componentTypes.findUnique).not.toHaveBeenCalled()
    expect(mocked.componentModels.count).not.toHaveBeenCalled()
  })

  it('returns 400 when the target type does not exist', async () => {
    mocked.componentTypes.findUnique.mockResolvedValue(null)

    const res = await request(app.callback())
      .put(`/component-subtypes/${subtypeId}`)
      .send({ typeId: surfaceTypeId })

    expect(res.status).toBe(400)
    expect(mocked.componentSubtypes.update).not.toHaveBeenCalled()
  })
})
