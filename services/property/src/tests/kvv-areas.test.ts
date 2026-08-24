import request from 'supertest'

import app from '../app'
import * as kvvAreaAdapter from '../adapters/kvv-area-adapter'

afterEach(() => {
  jest.restoreAllMocks()
})

const kvvAreaListItem = (code: string, responsible: string | null) => ({
  id: '11111111-1111-1111-1111-111111111111',
  code,
  name: null,
  costCenter: {
    id: '33333333-3333-3333-3333-333333333333',
    code: '61140',
    name: 'Distrikt Väst',
  },
  responsibleKeycloakUserId: responsible,
})

describe('GET /kvv-areas', () => {
  it('returns the matching kvv-areas (with cost center) for responsible user ids', async () => {
    const spy = jest
      .spyOn(kvvAreaAdapter, 'listKvvAreas')
      .mockResolvedValue([
        kvvAreaListItem('A1', 'u1'),
        kvvAreaListItem('A2', 'u2'),
      ])

    const res = await request(app.callback()).get(
      '/kvv-areas?responsibleUserId=u1&responsibleUserId=u2'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      kvvAreaListItem('A1', 'u1'),
      kvvAreaListItem('A2', 'u2'),
    ])
    expect(spy).toHaveBeenCalledWith({ responsibleUserIds: ['u1', 'u2'] })
  })

  it('returns every kvv-area when no responsibleUserId param is given', async () => {
    const spy = jest
      .spyOn(kvvAreaAdapter, 'listKvvAreas')
      .mockResolvedValue([kvvAreaListItem('A1', null)])

    const res = await request(app.callback()).get('/kvv-areas')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([kvvAreaListItem('A1', null)])
    expect(spy).toHaveBeenCalledWith({ responsibleUserIds: undefined })
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'listKvvAreas')
      .mockRejectedValue(new Error('boom'))

    const res = await request(app.callback()).get(
      '/kvv-areas?responsibleUserId=u1'
    )

    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('boom')
  })
})

const KVV_AREA_ID = '11111111-1111-1111-1111-111111111111'
const NEW_RESPONSIBLE_ID = '22222222-2222-2222-2222-222222222222'
const UPDATED_BY = 'caller-keycloak-id'

const mockUpdatedRecord = () => ({
  id: KVV_AREA_ID,
  code: 'KVV-1',
  name: 'Område 1',
  costCenterId: '33333333-3333-3333-3333-333333333333',
  responsibleKeycloakUserId: NEW_RESPONSIBLE_ID,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-05-27'),
  updatedBy: UPDATED_BY,
})

describe('PATCH /kvv-areas/:id/responsible', () => {
  it('returns 200 with the updated record on success', async () => {
    const record = mockUpdatedRecord()
    const spy = jest
      .spyOn(kvvAreaAdapter, 'updateKvvAreaResponsible')
      .mockResolvedValueOnce({ ok: true, data: record })

    const res = await request(app.callback())
      .patch(`/kvv-areas/${KVV_AREA_ID}/responsible`)
      .send({ keycloakUserId: NEW_RESPONSIBLE_ID, updatedBy: UPDATED_BY })

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: KVV_AREA_ID,
      responsibleKeycloakUserId: NEW_RESPONSIBLE_ID,
      updatedBy: UPDATED_BY,
    })
    expect(spy).toHaveBeenCalledWith(KVV_AREA_ID, {
      responsibleKeycloakUserId: NEW_RESPONSIBLE_ID,
      updatedBy: UPDATED_BY,
    })
  })

  it('returns 404 when the kvv-area is missing', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'updateKvvAreaResponsible')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback())
      .patch(`/kvv-areas/${KVV_AREA_ID}/responsible`)
      .send({ keycloakUserId: NEW_RESPONSIBLE_ID, updatedBy: UPDATED_BY })

    expect(res.status).toBe(404)
  })

  it('returns 400 when the body is missing keycloakUserId', async () => {
    const res = await request(app.callback())
      .patch(`/kvv-areas/${KVV_AREA_ID}/responsible`)
      .send({ updatedBy: UPDATED_BY })

    expect(res.status).toBe(400)
  })

  it('returns 400 when keycloakUserId is not a uuid', async () => {
    const res = await request(app.callback())
      .patch(`/kvv-areas/${KVV_AREA_ID}/responsible`)
      .send({ keycloakUserId: 'not-a-uuid', updatedBy: UPDATED_BY })

    expect(res.status).toBe(400)
  })

  it('returns 400 when the path id is not a uuid', async () => {
    const res = await request(app.callback())
      .patch('/kvv-areas/not-a-uuid/responsible')
      .send({ keycloakUserId: NEW_RESPONSIBLE_ID, updatedBy: UPDATED_BY })

    expect(res.status).toBe(400)
  })

  it('returns 500 when the adapter throws an unexpected error', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'updateKvvAreaResponsible')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback())
      .patch(`/kvv-areas/${KVV_AREA_ID}/responsible`)
      .send({ keycloakUserId: NEW_RESPONSIBLE_ID, updatedBy: UPDATED_BY })

    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('Internal server error')
  })
})
