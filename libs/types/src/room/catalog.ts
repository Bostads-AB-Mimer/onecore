// Curated Xpand room type code → allowed captions. First caption is the
// default when caller omits it. alwaysNumber: true numbers from RUM 1, false
// uses the base name then 2, 3, ... startingRoomCode: indoor types start at
// 01, outdoor/auxiliary (BAL, UP, BRS) at 20; getNextRoomCode picks the
// lowest free slot at or above and may spill past the next bucket if full.
// Shared by property service (validation) and property-tree (form dropdowns).
export type RoomCaptionTemplate = {
  typeCode: string
  typeLabel: string
  captionOptions: readonly [string, ...string[]]
  alwaysNumber: boolean
  startingRoomCode: number
}

export const ROOM_CAPTION_TEMPLATES: readonly RoomCaptionTemplate[] = [
  {
    typeCode: 'BAD',
    typeLabel: 'Badrum',
    captionOptions: ['BADRUM'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'BAL',
    typeLabel: 'Balkong',
    captionOptions: ['BALKONG', 'BALKONG (Inglasad)'],
    alwaysNumber: false,
    startingRoomCode: 20,
  },
  {
    typeCode: 'BRS',
    typeLabel: 'Säkerhetsutrustning',
    captionOptions: ['SÄKERHETSUTRUSTNING'],
    alwaysNumber: false,
    startingRoomCode: 20,
  },
  {
    typeCode: 'DUSCH',
    typeLabel: 'Duschrum',
    captionOptions: ['DUSCHRUM', 'DUSCH'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'FÖR',
    typeLabel: 'Förråd',
    captionOptions: ['FÖRRÅD'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'GROV',
    typeLabel: 'Grovkök',
    captionOptions: ['GROVKÖK'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'HALL',
    typeLabel: 'Hall',
    captionOptions: ['HALL', 'HALL LITEN'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'KLÄD',
    typeLabel: 'Klädkammare',
    captionOptions: ['KLÄDKAMMARE'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'KÖK',
    typeLabel: 'Kök',
    captionOptions: ['KÖK'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'KOV',
    typeLabel: 'Kök/vardagsrum',
    captionOptions: ['KÖK/VARDAGSRUM'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'KV',
    typeLabel: 'Kokvrå',
    captionOptions: ['KOKVRÅ'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'MAT',
    typeLabel: 'Matplats',
    captionOptions: ['MATPLATS'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'PA',
    typeLabel: 'Passage',
    captionOptions: ['PASSAGE'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'RUM',
    typeLabel: 'Rum',
    captionOptions: ['RUM'],
    alwaysNumber: true,
    startingRoomCode: 1,
  },
  {
    typeCode: 'TRAPP',
    typeLabel: 'Trappa',
    captionOptions: ['TRAPP', 'TRAPP MED VINDFÅNG'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'UP',
    typeLabel: 'Uteplats',
    captionOptions: ['UTEPLATS', 'UTEPLATS (ALTAN)'],
    alwaysNumber: false,
    startingRoomCode: 20,
  },
  {
    typeCode: 'VARD',
    typeLabel: 'Vardagsrum',
    captionOptions: ['VARDAGSRUM'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'WC',
    typeLabel: 'Toalett',
    captionOptions: ['WC'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
  {
    typeCode: 'WC/DU1',
    typeLabel: 'Wc/Dusch 1',
    captionOptions: ['WC/DUSCH'],
    alwaysNumber: false,
    startingRoomCode: 1,
  },
] as const

export const ALL_VALID_TYPE_CODES = [
  'BAD',
  'BAL',
  'BRS',
  'DUSCH',
  'FÖR',
  'GROV',
  'HALL',
  'KLÄD',
  'KÖK',
  'KOV',
  'KV',
  'MAT',
  'PA',
  'RUM',
  'TRAPP',
  'UP',
  'VARD',
  'WC',
  'WC/DU1',
] as const

export type ValidRoomTypeCode = (typeof ALL_VALID_TYPE_CODES)[number]

const TEMPLATES_BY_CODE = new Map(
  ROOM_CAPTION_TEMPLATES.map((t) => [t.typeCode, t])
)

export const getCaptionOptionsForType = (typeCode: string): string[] =>
  TEMPLATES_BY_CODE.get(typeCode)?.captionOptions.slice() ?? []

export const isValidCaptionForType = (
  typeCode: string,
  caption: string
): boolean => getCaptionOptionsForType(typeCode).includes(caption)

export const alwaysNumberFor = (typeCode: string): boolean =>
  TEMPLATES_BY_CODE.get(typeCode)?.alwaysNumber ?? false

export const getDefaultCaption = (typeCode: string): string | null =>
  TEMPLATES_BY_CODE.get(typeCode)?.captionOptions[0] ?? null

// Unknown type codes fall back to 1 (indoor).
export const startingRoomCodeFor = (typeCode: string): number =>
  TEMPLATES_BY_CODE.get(typeCode)?.startingRoomCode ?? 1