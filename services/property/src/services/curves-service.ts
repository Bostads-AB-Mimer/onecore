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
const ONE_HOUR_SECONDS = 60 * 60

// EcoGuard's /data endpoint returns 400 unless `from` and `to` are aligned
// to the bucket size implied by `interval` (hour for 'H', day for 'D').
const bucketSeconds = (interval: ApartmentTemperaturesInterval) =>
  interval === 'H' ? ONE_HOUR_SECONDS : ONE_DAY_SECONDS

const alignDown = (unixSeconds: number, bucket: number) =>
  Math.floor(unixSeconds / bucket) * bucket

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
  const interval = query.interval ?? DEFAULT_INTERVAL
  const bucket = bucketSeconds(interval)

  const rawTo = query.to ?? nowSeconds
  const rawFrom = query.from ?? rawTo - ONE_DAY_SECONDS

  let to = alignDown(rawTo, bucket)
  const from = alignDown(rawFrom, bucket)
  if (to <= from) to = from + bucket

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
