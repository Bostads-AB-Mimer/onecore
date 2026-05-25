export interface BuildingTypeStyle {
  bg: string
  text: string
  label: string
}

const RESIDENTIAL_STYLE: BuildingTypeStyle = {
  bg: 'bg-slate-100',
  text: 'text-slate-800',
  label: 'Bostad',
}

const PARKING_STYLE: BuildingTypeStyle = {
  bg: 'bg-amber-100',
  text: 'text-amber-900',
  label: 'Parkering',
}

const COMMERCIAL_STYLE: BuildingTypeStyle = {
  bg: 'bg-blue-100',
  text: 'text-blue-900',
  label: 'Lokal',
}

const EDUCATION_STYLE: BuildingTypeStyle = {
  bg: 'bg-green-100',
  text: 'text-green-900',
  label: 'Skola',
}

const UTILITY_STYLE: BuildingTypeStyle = {
  bg: 'bg-zinc-100',
  text: 'text-zinc-700',
  label: 'Teknik',
}

const COMMUNITY_STYLE: BuildingTypeStyle = {
  bg: 'bg-purple-100',
  text: 'text-purple-900',
  label: 'Gemensamt',
}

// Codes from Xpand babyt table. Categories drive color; the displayed label
// comes from the API-returned buildingType.name.
export const BUILDING_TYPE_STYLES: Record<string, BuildingTypeStyle> = {
  // Residential
  FLER: RESIDENTIAL_STYLE,
  RADHUS: RESIDENTIAL_STYLE,
  VILLA: RESIDENTIAL_STYLE,
  PARHUS: RESIDENTIAL_STYLE,
  TVÅFAM: RESIDENTIAL_STYLE,
  STUD: RESIDENTIAL_STYLE,
  SERV: RESIDENTIAL_STYLE,
  // Parking
  'P-OMR': PARKING_STYLE,
  'P-HUS': PARKING_STYLE,
  GARAGE: PARKING_STYLE,
  'C-GARA': PARKING_STYLE,
  CARPOR: PARKING_STYLE,
  'MC-GAR': PARKING_STYLE,
  // Commercial
  BUTIK: COMMERCIAL_STYLE,
  KONTOR: COMMERCIAL_STYLE,
  KIOSK: COMMERCIAL_STYLE,
  REKLAM: COMMERCIAL_STYLE,
  // Education / care
  FÖRSKO: EDUCATION_STYLE,
  SKOL: EDUCATION_STYLE,
  BARN: EDUCATION_STYLE,
  // Utility / infrastructure
  TRANSF: UTILITY_STYLE,
  VERKST: UTILITY_STYLE,
  TVÄTT: UTILITY_STYLE,
  BRUKSM: UTILITY_STYLE,
  // Community / misc
  CENTR: COMMUNITY_STYLE,
  KULTUR: COMMUNITY_STYLE,
  GEMEN: COMMUNITY_STYLE,
  // Storage / land — fall back to muted via getBuildingTypeStyle: TOMTM, FÖRRÅD, MILJÖ
}

export function getBuildingTypeStyle(
  code: string | undefined
): BuildingTypeStyle | null {
  if (!code) return null
  return (
    BUILDING_TYPE_STYLES[code] || {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      label: code,
    }
  )
}
