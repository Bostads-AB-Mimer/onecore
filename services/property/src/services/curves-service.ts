import {
  getApartmentNode,
  getNodeTemperatureSeries,
} from '../adapters/curves-adapter'
import {
  ApartmentTemperaturesInterval,
  ApartmentTemperaturesResponse,
  EcoGuardDataResponse,
} from '../types/curves'

const DEFAULT_INTERVAL: ApartmentTemperaturesInterval = 'H'
const ONE_DAY_SECONDS = 24 * 60 * 60

export class ApartmentNodeNotFoundError extends Error {
  constructor(objectNumber: string) {
    super(`No EcoGuard apartment node for objectNumber=${objectNumber}`)
    this.name = 'ApartmentNodeNotFoundError'
  }
}

const mergeResultsByTime = (result: EcoGuardDataResponse[number]['Result']) => {
  const points = new Map<
    number,
    { time: number; avg: number | null; min: number | null; max: number | null }
  >()

  for (const entry of result) {
    for (const { Time, Value } of entry.Values) {
      const existing = points.get(Time) ?? {
        time: Time,
        avg: null,
        min: null,
        max: null,
      }
      // Func values from EcoGuard: 'avg' | 'min' | 'max'.
      if (entry.Func === 'avg') existing.avg = Value
      else if (entry.Func === 'min') existing.min = Value
      else if (entry.Func === 'max') existing.max = Value
      points.set(Time, existing)
    }
  }

  return [...points.values()].sort((a, b) => a.time - b.time)
}

export const getApartmentTemperatures = async (
  objectNumber: string,
  query: {
    from?: number
    to?: number
    interval?: ApartmentTemperaturesInterval
  }
): Promise<ApartmentTemperaturesResponse> => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const to = query.to ?? nowSeconds
  const from = query.from ?? to - ONE_DAY_SECONDS
  const interval = query.interval ?? DEFAULT_INTERVAL

  const node = await getApartmentNode(objectNumber)
  if (!node) throw new ApartmentNodeNotFoundError(objectNumber)

  const raw = await getNodeTemperatureSeries(node.ID, from, to, interval)

  const unit = raw[0]?.Result[0]?.Unit ?? ''

  const series = raw.map((subNode) => ({
    subNodeId: subNode.ID,
    subNodeName: subNode.Name,
    points: mergeResultsByTime(subNode.Result),
  }))

  return {
    objectNumber,
    nodeId: node.ID,
    from,
    to,
    interval,
    unit,
    series,
  }
}
