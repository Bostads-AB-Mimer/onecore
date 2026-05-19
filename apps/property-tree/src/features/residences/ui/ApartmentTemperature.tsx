import type { ApartmentTemperatureSeries } from '@/services/api/core'

import { useApartmentTemperature } from '../hooks/useApartmentTemperature'

const MISSING_LABEL = 'Uppgifter om temperatur saknas'

const pad = (n: number) => String(n).padStart(2, '0')

const formatRecordedAt = (unixSeconds: number) => {
  const d = new Date(unixSeconds * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Reading = { avg: number; time: number } | null

const computeLatestAverage = (
  series: ApartmentTemperatureSeries[]
): Reading => {
  let latestTime: number | null = null
  for (const s of series) {
    for (const p of s.points) {
      if (p.avg !== null && (latestTime === null || p.time > latestTime)) {
        latestTime = p.time
      }
    }
  }
  if (latestTime === null) return null

  const avgs = series
    .flatMap((s) => s.points.filter((p) => p.time === latestTime))
    .map((p) => p.avg)
    .filter((v): v is number => v !== null)

  if (avgs.length === 0) return null
  return {
    time: latestTime,
    avg: avgs.reduce((sum, v) => sum + v, 0) / avgs.length,
  }
}

interface ApartmentTemperatureProps {
  objectNumber: string | undefined
}

export const ApartmentTemperature = ({
  objectNumber,
}: ApartmentTemperatureProps) => {
  const { data, isLoading, isError } = useApartmentTemperature(objectNumber)

  const reading =
    !isLoading && !isError && data ? computeLatestAverage(data.series) : null

  return (
    <div>
      <p className="text-sm text-muted-foreground">Temperatur</p>
      {isLoading ? (
        <p className="font-medium text-muted-foreground">Hämtar…</p>
      ) : reading ? (
        <>
          <p className="font-medium">
            {reading.avg.toLocaleString('sv-SE', {
              maximumFractionDigits: 1,
            })}{' '}
            °C
          </p>
          <p className="text-xs text-muted-foreground">
            Senast registrerad: {formatRecordedAt(reading.time)}
          </p>
        </>
      ) : (
        <p className="font-medium text-muted-foreground">{MISSING_LABEL}</p>
      )}
    </div>
  )
}
