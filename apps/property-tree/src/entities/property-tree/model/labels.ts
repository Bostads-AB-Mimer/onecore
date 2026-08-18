import type { PropertyTreeLevel } from './selection'

export const LEVEL_LABELS: Record<PropertyTreeLevel, string> = {
  district: 'Distrikt',
  kvvArea: 'KVV-område',
  marketArea: 'Marknadsområde',
  property: 'Fastighet',
  building: 'Byggnad',
  parkingArea: 'Parkeringsområde',
  staircase: 'Trapphus',
  object: 'Hyresobjekt',
}

// Group-chip headers when many chips of one level collapse into one.
export const LEVEL_PLURAL_LABELS: Record<PropertyTreeLevel, string> = {
  district: 'Distrikt',
  kvvArea: 'KVV-områden',
  marketArea: 'Marknadsområden',
  property: 'Fastigheter',
  building: 'Byggnader',
  parkingArea: 'Parkeringsområden',
  staircase: 'Trapphus',
  object: 'Hyresobjekt',
}

// Stored criterion values are bare codes for some levels (building, kvv-area).
// The picker remembers value → display label for the session so chips can show
// e.g. the street name; falls back to the raw value after a reload.
const labelByLevelValue = new Map<string, string>()

export function rememberNodeLabel(
  level: PropertyTreeLevel,
  value: string,
  label: string
): void {
  if (label !== value) labelByLevelValue.set(`${level}:${value}`, label)
}

export function nodeValueLabel(
  level: PropertyTreeLevel,
  value: string
): string {
  return labelByLevelValue.get(`${level}:${value}`) ?? value
}
