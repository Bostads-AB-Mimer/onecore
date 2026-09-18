import type { PropertyTreeLevel, RentalObjectType } from './selection'

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

/** What a grouping's roots are called — the picker's switcher buttons. */
export const GROUPING_LABELS = {
  costCenter: LEVEL_LABELS.district,
  marketArea: LEVEL_LABELS.marketArea,
} as const

export const RENTAL_OBJECT_GROUP_LABELS: Record<RentalObjectType, string> = {
  residence: 'Bostäder',
  parkingSpace: 'Bilplatser',
  facility: 'Lokaler',
  other: 'Övrigt',
}

export const RENTAL_OBJECT_TYPE_LABELS: Record<RentalObjectType, string> = {
  residence: 'Bostad',
  parkingSpace: 'Bilplats',
  facility: 'Lokal',
  other: 'Övrigt',
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
