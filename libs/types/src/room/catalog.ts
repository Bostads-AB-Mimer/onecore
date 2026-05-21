/**
 * Curated mapping of Xpand room type codes (barut.code) to allowed
 * room captions, with an alwaysNumber flag controlling auto-numbering
 * behaviour. Derived from the most common type/caption combinations
 * in production Mimer data (combinations with ≥100 occurrences, after
 * deduplicating reversed synonyms and typos).
 *
 * The first caption per type is the default chosen when the API
 * caller omits the caption.
 *
 * alwaysNumber semantics:
 *  - true  → the very first room of this type is numbered (RUM 1, then RUM 2, ...)
 *  - false → first room uses the base name (HALL), second is HALL 2, etc.
 *
 * Shared between the property service (server-side write validation)
 * and the property-tree frontend (form dropdowns) so both surfaces
 * stay in lockstep without an extra API hop.
 */
export type RoomCaptionTemplate = {
  typeCode: string
  typeLabel: string
  captionOptions: readonly [string, ...string[]]
  alwaysNumber: boolean
}

export const ROOM_CAPTION_TEMPLATES: readonly RoomCaptionTemplate[] = [
  {
    typeCode: 'BAD',
    typeLabel: 'Badrum',
    captionOptions: ['BADRUM'],
    alwaysNumber: false,
  },
  {
    typeCode: 'BAL',
    typeLabel: 'Balkong',
    captionOptions: ['BALKONG', 'BALKONG (Inglasad)'],
    alwaysNumber: false,
  },
  {
    typeCode: 'BRS',
    typeLabel: 'Säkerhetsutrustning',
    captionOptions: ['SÄKERHETSUTRUSTNING'],
    alwaysNumber: false,
  },
  {
    typeCode: 'DUSCH',
    typeLabel: 'Duschrum',
    captionOptions: ['DUSCHRUM', 'DUSCH'],
    alwaysNumber: false,
  },
  {
    typeCode: 'FÖR',
    typeLabel: 'Förråd',
    captionOptions: ['FÖRRÅD'],
    alwaysNumber: false,
  },
  {
    typeCode: 'GROV',
    typeLabel: 'Grovkök',
    captionOptions: ['GROVKÖK'],
    alwaysNumber: false,
  },
  {
    typeCode: 'HALL',
    typeLabel: 'Hall',
    captionOptions: ['HALL', 'HALL LITEN'],
    alwaysNumber: false,
  },
  {
    typeCode: 'KLÄD',
    typeLabel: 'Klädkammare',
    captionOptions: ['KLÄDKAMMARE'],
    alwaysNumber: false,
  },
  {
    typeCode: 'KLÄD2',
    typeLabel: 'Klädkammare 2',
    captionOptions: ['KLÄDKAMMARE 2'],
    alwaysNumber: false,
  },
  {
    typeCode: 'KÖK',
    typeLabel: 'Kök',
    captionOptions: ['KÖK'],
    alwaysNumber: false,
  },
  {
    typeCode: 'KOV',
    typeLabel: 'Kök/vardagsrum',
    captionOptions: ['KÖK/VARDAGSRUM'],
    alwaysNumber: false,
  },
  {
    typeCode: 'KV',
    typeLabel: 'Kokvrå',
    captionOptions: ['KOKVRÅ'],
    alwaysNumber: false,
  },
  {
    typeCode: 'MAT',
    typeLabel: 'Matplats',
    captionOptions: ['MATPLATS'],
    alwaysNumber: false,
  },
  {
    typeCode: 'PA',
    typeLabel: 'Passage',
    captionOptions: ['PASSAGE'],
    alwaysNumber: false,
  },
  {
    typeCode: 'RUM',
    typeLabel: 'Rum',
    captionOptions: ['RUM'],
    alwaysNumber: true,
  },
  {
    typeCode: 'TRAPP',
    typeLabel: 'Trappa',
    captionOptions: ['TRAPP', 'TRAPP MED VINDFÅNG'],
    alwaysNumber: false,
  },
  {
    typeCode: 'UP',
    typeLabel: 'Uteplats',
    captionOptions: ['UTEPLATS', 'UTEPLATS (ALTAN)'],
    alwaysNumber: false,
  },
  {
    typeCode: 'VARD',
    typeLabel: 'Vardagsrum',
    captionOptions: ['VARDAGSRUM'],
    alwaysNumber: false,
  },
  {
    typeCode: 'WC',
    typeLabel: 'Toalett',
    captionOptions: ['WC'],
    alwaysNumber: false,
  },
  {
    typeCode: 'WC/DU1',
    typeLabel: 'Wc/Dusch 1',
    captionOptions: ['WC/DUSCH'],
    alwaysNumber: false,
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
  'KLÄD2',
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
