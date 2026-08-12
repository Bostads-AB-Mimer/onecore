import type { AudienceLevel } from './selection'

export const AUDIENCE_LEVEL_LABELS: Record<AudienceLevel, string> = {
  district: 'Distrikt',
  kvvArea: 'KVV-område',
  property: 'Fastighet',
  building: 'Byggnad',
  parkingArea: 'Parkeringsområde',
  staircase: 'Trapphus',
}

// Group-chip headers when many chips of one level collapse into one.
export const AUDIENCE_LEVEL_PLURAL_LABELS: Record<AudienceLevel, string> = {
  district: 'Distrikt',
  kvvArea: 'KVV-områden',
  property: 'Fastigheter',
  building: 'Byggnader',
  parkingArea: 'Parkeringsområden',
  staircase: 'Trapphus',
}

// Stored criterion values are bare codes for some levels (building, kvv-area).
// The picker remembers value → display label for the session so chips can show
// e.g. the street name; falls back to the raw value after a reload.
const labelByLevelValue = new Map<string, string>()

export function rememberAudienceLabel(
  level: AudienceLevel,
  value: string,
  label: string
): void {
  if (label !== value) labelByLevelValue.set(`${level}:${value}`, label)
}

export function audienceValueLabel(
  level: AudienceLevel,
  value: string
): string {
  return labelByLevelValue.get(`${level}:${value}`) ?? value
}
