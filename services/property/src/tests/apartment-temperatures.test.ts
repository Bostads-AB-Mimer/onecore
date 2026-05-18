import request from 'supertest'

import app from '../app'
import * as curvesAdapter from '../adapters/curves-adapter'
import type {
  EcoGuardApartmentNode,
  EcoGuardDataResponse,
} from '../types/curves'

beforeEach(jest.restoreAllMocks)

const apartmentNode: EcoGuardApartmentNode = {
  ObjectNumber: '806-032-01-0101',
  ParentNodeID: 3747,
  ID: 3748,
  Name: '901',
  NodeType: { ID: 13, Code: 9, Name: 'Lägenhet' },
}

const ecoguardData: EcoGuardDataResponse = [
  {
    ID: 6076890,
    Name: '60004654',
    Result: [
      {
        Utl: 'T',
        Func: 'avg',
        Unit: 'cel',
        Values: [
          { Time: 1778839200, Value: 23.6675 },
          { Time: 1778842800, Value: 23.5275 },
        ],
      },
      {
        Utl: 'T',
        Func: 'min',
        Unit: 'cel',
        Values: [
          { Time: 1778839200, Value: 23.0 },
          { Time: 1778842800, Value: 23.1 },
        ],
      },
      {
        Utl: 'T',
        Func: 'max',
        Unit: 'cel',
        Values: [
          { Time: 1778839200, Value: 24.0 },
          { Time: 1778842800, Value: 24.1 },
        ],
      },
    ],
  },
]

describe('GET /apartments/:objectNumber/temperatures', () => {
  it('merges avg/min/max per timestamp and returns 200', async () => {
    jest
      .spyOn(curvesAdapter, 'getApartmentNode')
      .mockResolvedValueOnce(apartmentNode)
    jest
      .spyOn(curvesAdapter, 'getNodeTemperatureSeries')
      .mockResolvedValueOnce(ecoguardData)

    const res = await request(app.callback()).get(
      '/apartments/806-032-01-0101/temperatures?from=1778839200&to=1779444000&interval=H'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      objectNumber: '806-032-01-0101',
      nodeId: 3748,
      from: 1778839200,
      to: 1779444000,
      interval: 'H',
      unit: 'cel',
    })
    expect(res.body.content.series).toHaveLength(1)
    expect(res.body.content.series[0]).toMatchObject({
      subNodeId: 6076890,
      subNodeName: '60004654',
    })
    expect(res.body.content.series[0].points).toEqual([
      { time: 1778839200, avg: 23.6675, min: 23.0, max: 24.0 },
      { time: 1778842800, avg: 23.5275, min: 23.1, max: 24.1 },
    ])
  })

  it('returns 404 when the apartment node is not found', async () => {
    jest.spyOn(curvesAdapter, 'getApartmentNode').mockResolvedValueOnce(null)
    const seriesSpy = jest.spyOn(curvesAdapter, 'getNodeTemperatureSeries')

    const res = await request(app.callback()).get(
      '/apartments/000-000-00-0000/temperatures'
    )

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('apartment-node-not-found')
    expect(seriesSpy).not.toHaveBeenCalled()
  })

  it('returns 400 when `to` is not greater than `from`', async () => {
    const res = await request(app.callback()).get(
      '/apartments/806-032-01-0101/temperatures?from=2000&to=1000'
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when `interval` is invalid', async () => {
    const res = await request(app.callback()).get(
      '/apartments/806-032-01-0101/temperatures?interval=X'
    )

    expect(res.status).toBe(400)
  })

  it('applies default range (last 24h, hourly) when no query params given', async () => {
    const nodeSpy = jest
      .spyOn(curvesAdapter, 'getApartmentNode')
      .mockResolvedValueOnce(apartmentNode)
    const seriesSpy = jest
      .spyOn(curvesAdapter, 'getNodeTemperatureSeries')
      .mockResolvedValueOnce([])

    const before = Math.floor(Date.now() / 1000)
    const res = await request(app.callback()).get(
      '/apartments/806-032-01-0101/temperatures'
    )
    const after = Math.floor(Date.now() / 1000)

    expect(res.status).toBe(200)
    expect(nodeSpy).toHaveBeenCalledWith('806-032-01-0101')

    const [nodeIdArg, fromArg, toArg, intervalArg] = seriesSpy.mock.calls[0]
    expect(nodeIdArg).toBe(3748)
    expect(intervalArg).toBe('H')
    expect(toArg).toBeGreaterThanOrEqual(before)
    expect(toArg).toBeLessThanOrEqual(after)
    expect(toArg - fromArg).toBe(24 * 60 * 60)
  })

  it('returns 500 when the upstream adapter throws an unexpected error', async () => {
    jest
      .spyOn(curvesAdapter, 'getApartmentNode')
      .mockRejectedValueOnce(new Error('upstream blew up'))

    const res = await request(app.callback()).get(
      '/apartments/806-032-01-0101/temperatures'
    )

    expect(res.status).toBe(500)
  })
})
