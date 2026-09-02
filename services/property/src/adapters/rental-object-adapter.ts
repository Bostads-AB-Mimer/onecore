import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import { cachedBatch } from '@src/utils/promise-cache'
import type {
  RentalObjectDetails,
  RentalObjectScopeParams,
  RentalObjectSummary,
  RentalObjectType,
  SearchRentalObjectsQueryParams,
} from '@src/types/rental-object'
import { RENTAL_OBJECT_TYPES } from '@src/types/rental-object'

import { operatingCompanyFilter } from './company-scope'
import { prisma } from './db'

type RentalObjectRow = {
  rentalId: string
  objectTypeId: string
  residenceCode: string | null
  residenceName: string | null
  parkingSpaceCode: string | null
  parkingSpaceName: string | null
  facilityCode: string | null
  facilityName: string | null
  rentalObjectCode: string | null
  rentalObjectName: string | null
  subtypeCode: string | null
  subtypeName: string | null
  buildingCode: string | null
  staircaseCode: string | null
  staircaseName: string | null
  parkingAreaCode: string | null
  propertyCode: string | null
  propertyName: string | null
  address: string | null
}

// The four rentable object types. babuf rows for rooms/components inherit
// their parent's hyresid, so keycmobt is the authoritative filter — not
// hyresid alone.
const TYPE_BY_KEYCMOBT: Record<string, RentalObjectType> = {
  balgh: 'residence',
  babps: 'parkingSpace',
  balok: 'facility',
  bahyr: 'other',
}

const KEYCMOBT_BY_TYPE: Record<RentalObjectType, string> = {
  residence: 'balgh',
  parkingSpace: 'babps',
  facility: 'balok',
  other: 'bahyr',
}

const codeAndName = (
  type: RentalObjectType,
  row: RentalObjectRow
): { code: string | null; name: string | null } => {
  switch (type) {
    case 'residence':
      return { code: row.residenceCode, name: row.residenceName }
    case 'parkingSpace':
      return { code: row.parkingSpaceCode, name: row.parkingSpaceName }
    case 'facility':
      return { code: row.facilityCode, name: row.facilityName }
    case 'other':
      return { code: row.rentalObjectCode, name: row.rentalObjectName }
  }
}

// One rental object per babuf structure row. Kept as one definition because
// three call sites read the same columns out of the same joins. Every column
// must stay 1:1 with hyresid — see the pagination note in searchRentalObjects.
//
// The covering index below is applied BY HAND per environment (babuf is
// Xpand's table — no migration manages it). Its INCLUDE list must carry every
// babuf column the adapters read, or the queries fall back to key lookups;
// reading a new column in any adapter query means extending it. Canonical
// definition, kept in sync with the queries:
//
//   CREATE NONCLUSTERED INDEX IX_babuf_onecore_fstcode_deletemark
//   ON dbo.babuf (fstcode, deletemark)
//   INCLUDE (
//     cmpcode, hyresid, keycmobj, fstcaption,
//     lghcode, lghcaption, bpscode, bpscaption,
//     lokcode, lokcaption, hyrcode, hyrcaption,
//     bygcode, bygcaption, vancode, vancaption, ytacode, ytacaption,
//     keyobjbyg, keyobjlgh, keyobjbps, keyobjvan, keyobjlok, keyobjhyr,
//     keyobjfst)
const OBJECT_SELECT = Prisma.sql`
  SELECT DISTINCT
    b.hyresid    AS rentalId,
    o.keycmobt   AS objectTypeId,
    b.lghcode    AS residenceCode,
    b.lghcaption AS residenceName,
    b.bpscode    AS parkingSpaceCode,
    b.bpscaption AS parkingSpaceName,
    b.lokcode    AS facilityCode,
    b.lokcaption AS facilityName,
    b.hyrcode    AS rentalObjectCode,
    b.hyrcaption AS rentalObjectName,
    COALESCE(gt.code, pt.code, lt.code, ht.code)
                 AS subtypeCode,
    COALESCE(gt.caption, pt.caption, lt.caption, ht.caption)
                 AS subtypeName,
    b.bygcode    AS buildingCode,
    b.vancode    AS staircaseCode,
    b.vancaption AS staircaseName,
    b.ytacode    AS parkingAreaCode,
    b.fstcode    AS propertyCode,
    b.fstcaption AS propertyName,
    a.adress1    AS address
`

// The spine both shapes walk: the structure row, its object type, and the
// residence row (lägenhetstyp here, anläggnings-ID in the details query).
const BASE_FROM = Prisma.sql`
  FROM dbo.babuf b
  INNER JOIN dbo.cmobj o ON o.keycmobj = b.keycmobj
  LEFT JOIN dbo.balgh lg ON lg.keycmobj = b.keycmobj
`

/**
 * What counts as a rental object row. babuf holds one row per structure
 * element and rooms/components inherit their parent's hyresid, so keycmobt is
 * the authoritative filter — filtering on hyresid alone silently returns room
 * rows whose joins are all null. Defined once so no query can forget it.
 *
 * Also cuts sold stock here (company 999): clients can name buildings and
 * rental ids directly, so the allowlist must bind on every row — not only
 * where property codes are resolved. cmpcode must sit in the index INCLUDE.
 */
const rentalObjectWhere = (typeCodes = Object.values(KEYCMOBT_BY_TYPE)) =>
  Prisma.sql`
    b.deletemark = 0
    AND b.hyresid IS NOT NULL
    AND b.hyresid NOT LIKE '%X'
    AND ${operatingCompanyFilter('b.cmpcode')}
    AND o.keycmobt IN (SELECT value FROM OPENJSON(${JSON.stringify(typeCodes)}))
  `

/** Property-code scope, the input both root-scoped queries take. */
const propertyCodeScope = (propertyCodes: string[]) =>
  Prisma.sql`b.fstcode IN (SELECT value FROM OPENJSON(${JSON.stringify(
    propertyCodes
  )}))`

/** Composite '504-017-01' = buildingCode '504-017' + staircase '01'. */
const staircasePairs = (composites: string[]) =>
  composites.flatMap((composite) => {
    const at = composite.lastIndexOf('-')
    if (at <= 0) return []
    return [{ b: composite.slice(0, at), v: composite.slice(at + 1) }]
  })

/** The scopes babuf carries a column for, as opposed to cost centres,
 * KVV-areas and marknadsområden. */
type StructureScope = Pick<
  RentalObjectScopeParams,
  'buildingCodes' | 'parkingAreaCodes' | 'staircaseCodes' | 'rentalIds'
>

/**
 * Those scopes as SQL, OR-ed. The grouping levels are absent on purpose:
 * babuf carries no column for them, so they arrive already resolved to
 * property codes.
 *
 * Staircases are matched as (building, staircase) pairs rather than on a
 * concatenated composite: `bygcode + '-' + vancode` can't use the covering
 * index, and this access pattern reads a lot of rows.
 */
const structureScopes = (params: StructureScope): Prisma.Sql[] => {
  const scopes: Prisma.Sql[] = []

  if (params.buildingCodes?.length) {
    scopes.push(
      Prisma.sql`b.bygcode IN (SELECT value FROM OPENJSON(${JSON.stringify(
        params.buildingCodes
      )}))`
    )
  }
  if (params.parkingAreaCodes?.length) {
    scopes.push(
      Prisma.sql`b.ytacode IN (SELECT value FROM OPENJSON(${JSON.stringify(
        params.parkingAreaCodes
      )}))`
    )
  }
  if (params.rentalIds?.length) {
    scopes.push(
      Prisma.sql`b.hyresid IN (SELECT value FROM OPENJSON(${JSON.stringify(
        params.rentalIds
      )}))`
    )
  }
  if (params.staircaseCodes?.length) {
    const pairs = staircasePairs(params.staircaseCodes)
    if (pairs.length > 0) {
      scopes.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM OPENJSON(${JSON.stringify(pairs)})
          WITH (b VARCHAR(50) '$.b', v VARCHAR(50) '$.v') j
          WHERE j.b = b.bygcode AND j.v = b.vancode
        )`
      )
    }
  }

  return scopes
}

/**
 * The properties holding the objects a structure-level scope covers — the
 * step that lets the details lookup take a selection and still key its cache
 * per property. Empty when the scope names no building, trapphus,
 * parkeringsområde or object. Only operating-company stock matches —
 * rentalObjectWhere cuts company 999.
 */
export const resolveStructurePropertyCodes = async (
  params: StructureScope
): Promise<string[]> => {
  const scopes = structureScopes(params)
  if (scopes.length === 0) return []

  try {
    const rows = await prisma
      .$queryRaw<{ propertyCode: string | null }[]>(
        Prisma.sql`
          SELECT DISTINCT b.fstcode AS propertyCode
          FROM dbo.babuf b
          INNER JOIN dbo.cmobj o ON o.keycmobj = b.keycmobj
          WHERE ${rentalObjectWhere()}
            AND (${Prisma.join(scopes, ' OR ')})
        `
      )
      .then(trimStrings)

    return rows.flatMap((row) => (row.propertyCode ? [row.propertyCode] : []))
  } catch (err) {
    logger.error({ err }, 'rental-object-adapter.resolveStructurePropertyCodes')
    throw err
  }
}

const OBJECT_FROM = Prisma.sql`
  ${BASE_FROM}
  LEFT JOIN dbo.balgt gt ON gt.keybalgt = lg.keybalgt
  LEFT JOIN dbo.babps ps ON ps.keycmobj = b.keycmobj
  LEFT JOIN dbo.babpt pt ON pt.keybabpt = ps.keybabpt
  LEFT JOIN dbo.balok lk ON lk.keycmobj = b.keycmobj
  LEFT JOIN dbo.balot lt ON lt.keybalot = lk.keybalot
  LEFT JOIN dbo.bahyr hr ON hr.keycmobj = b.keycmobj
  LEFT JOIN dbo.bahyt ht ON ht.keybahyt = hr.keybahyt
  LEFT JOIN dbo.cmadr a
    ON a.keycode = b.keycmobj
   AND a.keydbtbl = '_RQA11RNMA'
   AND a.keycmtyp = 'adrpost'
`

const toSummary = (
  row: RentalObjectRow,
  type: RentalObjectType
): RentalObjectSummary => ({
  rentalId: row.rentalId,
  type,
  ...codeAndName(type, row),
  subtypeCode: row.subtypeCode ?? null,
  subtypeName: row.subtypeName ?? null,
  address: row.address ?? null,
  buildingCode: row.buildingCode ?? null,
  staircaseCode: row.staircaseCode ?? null,
  staircaseName: row.staircaseName ?? null,
  parkingAreaCode: row.parkingAreaCode ?? null,
  propertyCode: row.propertyCode ?? null,
  propertyName: row.propertyName ?? null,
})

/** Structure rows → one summary per rental id, in row order. */
const dedupeByRentalId = (rows: RentalObjectRow[]): RentalObjectSummary[] => {
  const byRentalId = new Map<string, RentalObjectSummary>()
  for (const row of rows) {
    const type = TYPE_BY_KEYCMOBT[row.objectTypeId]
    if (!type || byRentalId.has(row.rentalId)) continue
    byRentalId.set(row.rentalId, toSummary(row, type))
  }
  return [...byRentalId.values()]
}

/**
 * All rental objects of one property or one building, as flat structure rows
 * from babuf: type, code/name, subtype caption, postal address and
 * building/staircase placement.
 */
export const getRentalObjects = async (scope: {
  propertyCode?: string
  buildingCode?: string
  exclude?: RentalObjectType[]
}): Promise<RentalObjectSummary[]> => {
  try {
    const scopeSql = scope.propertyCode
      ? Prisma.sql`b.fstcode = ${scope.propertyCode}`
      : Prisma.sql`b.bygcode = ${scope.buildingCode}`

    // Inverted into the include list the WHERE takes — excluded types are
    // never joined or shipped, rather than dropped here after the fact.
    const typeCodes = scope.exclude?.length
      ? RENTAL_OBJECT_TYPES.filter((t) => !scope.exclude?.includes(t)).map(
          (t) => KEYCMOBT_BY_TYPE[t]
        )
      : undefined

    const rows = await prisma
      .$queryRaw<RentalObjectRow[]>(
        Prisma.sql`
          ${OBJECT_SELECT}
          ${OBJECT_FROM}
          WHERE ${rentalObjectWhere(typeCodes)}
            AND ${scopeSql}
          ORDER BY b.hyresid
        `
      )
      .then(trimStrings)

    return dedupeByRentalId(rows)
  } catch (err) {
    logger.error({ err, scope }, 'rental-object-adapter.getRentalObjects')
    throw err
  }
}

/**
 * The listing-only values for many properties' objects: grundhyra, BRA,
 * "annan information av vikt" and anläggnings-ID. Deliberately a second query
 * rather than columns on the structure rows — only the object list shows
 * these, so the tree and the picker never carry them.
 *
 * Every join here is one row per object: hyinf is 1:1 on keycmobj, cmval is
 * filtered to one quantity type, and the anläggnings-ID comment is collapsed
 * with TOP 1 (several template rows can match).
 */
type RentalObjectDetailsRow = {
  rentalId: string
  propertyCode: string | null
  // Decimal columns arrive as Prisma.Decimal; toDetails coerces via Number().
  baseRent: number | Prisma.Decimal | null
  area: number | Prisma.Decimal | null
  additionalInfo: string | null
  malarEnergiFacilityId: string | null
}

const DETAILS_SELECT = Prisma.sql`
  SELECT DISTINCT
    b.hyresid     AS rentalId,
    b.fstcode     AS propertyCode,
    hi.akthyratot AS baseRent,
    bra.value     AS area,
    hi.otherinfo  AS additionalInfo,
    fac.text      AS malarEnergiFacilityId
`

// Every join is one row per object: hyinf is 1:1 on keycmobj, cmval is
// filtered to a single quantity type, and the anläggnings-ID comment is
// collapsed with TOP 1 (several template rows can match).
const DETAILS_FROM = Prisma.sql`
  FROM dbo.babuf b
  INNER JOIN dbo.cmobj o ON o.keycmobj = b.keycmobj
  LEFT JOIN dbo.balgh lg ON lg.keycmobj = b.keycmobj
  LEFT JOIN dbo.hyinf hi ON hi.keycmobj = b.keycmobj
  LEFT JOIN dbo.cmval bra
    ON bra.keycode = b.keycmobj
   AND bra.keycmvat = 'BRA'
  OUTER APPLY (
    SELECT TOP 1 tx.text
    FROM dbo.cmtex tx
    INNER JOIN dbo.cmtep tp ON tp.keycmtep = tx.keycmtep
    WHERE tx.keycode = lg.keybalgh
      AND tp.keycmtyp = 'balgh'
      AND tp.caption = 'Anläggningsid'
  ) fac
`

const toDetails = (row: RentalObjectDetailsRow): RentalObjectDetails => ({
  rentalId: row.rentalId,
  baseRent: row.baseRent == null ? null : Number(row.baseRent),
  area: row.area == null ? null : Number(row.area),
  additionalInfo: row.additionalInfo ?? null,
  malarEnergiFacilityId: row.malarEnergiFacilityId ?? null,
})

export const getRentalObjectDetailsByPropertyCodes = async (
  propertyCodes: string[]
): Promise<Map<string, RentalObjectDetails[]>> => {
  const out = new Map<string, RentalObjectDetails[]>()
  if (propertyCodes.length === 0) return out
  try {
    const rows = await prisma
      .$queryRaw<RentalObjectDetailsRow[]>(
        Prisma.sql`
          ${DETAILS_SELECT}
          ${DETAILS_FROM}
          WHERE ${rentalObjectWhere()}
            AND ${propertyCodeScope(propertyCodes)}
          ORDER BY b.hyresid
        `
      )
      .then(trimStrings)

    for (const code of propertyCodes) out.set(code, [])
    const seen = new Set<string>()
    for (const row of rows) {
      if (!row.propertyCode || seen.has(row.rentalId)) continue
      seen.add(row.rentalId)
      out.get(row.propertyCode)?.push(toDetails(row))
    }
    return out
  } catch (err) {
    logger.error(
      { err, properties: propertyCodes.length },
      'rental-object-adapter.getRentalObjectDetailsByPropertyCodes'
    )
    throw err
  }
}

// Its own cache and TTL, separate from the structure one: rent and comments
// change far more often than the hierarchy does, and only one page reads them.
const DETAILS_CACHE_TTL_MS = 10 * 60 * 1000

const detailsCache = cachedBatch<RentalObjectDetails[]>(
  DETAILS_CACHE_TTL_MS,
  getRentalObjectDetailsByPropertyCodes,
  () => []
)

export const clearRentalObjectDetailsCache = (): void => detailsCache.clear()

/**
 * Cached details for the given properties, refreshed as one batch when any
 * entry is missing or stale (see buildPropertySubtrees for the rationale).
 * Takes the codes as given — an unknown or sold code is an empty entry.
 */
export const buildRentalObjectDetails = async (
  propertyCodes: string[]
): Promise<RentalObjectDetails[]> => {
  const uniqueCodes = Array.from(new Set(propertyCodes))
  if (uniqueCodes.length === 0) return []

  const perProperty = await detailsCache.get(uniqueCodes)
  return perProperty.flat()
}

/**
 * Every rental object of many properties at once. Feeds the per-property cache
 * that clients read to filter and count locally, so it applies no filters of
 * its own — the caller keeps whatever it wants.
 */
export const getRentalObjectsByPropertyCodes = async (
  propertyCodes: string[]
): Promise<RentalObjectSummary[]> => {
  if (propertyCodes.length === 0) return []
  try {
    const rows = await prisma
      .$queryRaw<RentalObjectRow[]>(
        Prisma.sql`
          ${OBJECT_SELECT}
          ${OBJECT_FROM}
          WHERE ${rentalObjectWhere()}
            AND ${propertyCodeScope(propertyCodes)}
          ORDER BY b.hyresid
        `
      )
      .then(trimStrings)

    return dedupeByRentalId(rows)
  } catch (err) {
    logger.error(
      { err, properties: propertyCodes.length },
      'rental-object-adapter.getRentalObjectsByPropertyCodes'
    )
    throw err
  }
}

/**
 * Scoped search across rental objects.
 *
 * Scopes are alternatives — an object matches if it falls under any of them —
 * so one query answers "everything in this district plus this one building in
 * another". Cost centres and market areas resolve to property codes first,
 * because babuf carries neither.
 */
export const searchRentalObjects = async (
  params: SearchRentalObjectsQueryParams,
  resolvedPropertyCodes: string[]
): Promise<{ rows: RentalObjectSummary[]; totalCount: number }> => {
  const scopes = structureScopes(params)

  if (resolvedPropertyCodes.length > 0) {
    scopes.unshift(propertyCodeScope(resolvedPropertyCodes))
  }

  if (scopes.length === 0) return { rows: [], totalCount: 0 }

  const scopeSql = Prisma.join(scopes, ' OR ')
  const typeCodes = params.types?.length
    ? params.types.map((t) => KEYCMOBT_BY_TYPE[t])
    : Object.values(KEYCMOBT_BY_TYPE)

  // Subtypes arrive as 'type:code' because a code is only unique per type, and
  // they restrict per type: picking a parking subtype narrows bilplatser and
  // leaves the other types alone. A type nobody picked a subtype for passes.
  // VARCHARs sized wide: OPENJSON WITH truncates silently into a no-match.
  const subtypePairs = JSON.stringify(
    (params.subtypes ?? []).flatMap((s) => {
      const at = s.indexOf(':')
      if (at <= 0) return []
      const type = s.slice(0, at) as RentalObjectType
      const keycmobt = KEYCMOBT_BY_TYPE[type]
      if (!keycmobt) return []
      return [{ t: keycmobt, c: s.slice(at + 1) }]
    })
  )
  const subtypeSql = params.subtypes?.length
    ? Prisma.sql`AND (
        NOT EXISTS (
          SELECT 1 FROM OPENJSON(${subtypePairs})
          WITH (t VARCHAR(10) '$.t') j
          WHERE j.t = o.keycmobt
        )
        OR EXISTS (
          SELECT 1 FROM OPENJSON(${subtypePairs})
          WITH (t VARCHAR(10) '$.t', c VARCHAR(50) '$.c') j
          WHERE j.t = o.keycmobt
            AND j.c = COALESCE(gt.code, pt.code, lt.code, ht.code)
        )
      )`
    : Prisma.empty

  // q is taken verbatim: %, _ and [ keep their LIKE semantics on purpose —
  // power users can wildcard, and a stray _ at worst over-matches.
  const searchSql = params.q
    ? Prisma.sql`AND (b.hyresid LIKE ${'%' + params.q + '%'}
        OR a.adress1 LIKE ${'%' + params.q + '%'}
        OR b.fstcaption LIKE ${'%' + params.q + '%'})`
    : Prisma.empty

  const from = Prisma.sql`
    ${OBJECT_FROM}
    WHERE ${rentalObjectWhere(typeCodes)}
      AND (${scopeSql})
      ${subtypeSql}
      ${searchSql}
  `

  try {
    const offset = (params.page - 1) * params.limit
    const [countRows, rows] = await Promise.all([
      prisma.$queryRaw<{ total: number | bigint }[]>(
        Prisma.sql`SELECT COUNT(DISTINCT b.hyresid) AS total ${from}`
      ),
      prisma
        .$queryRaw<RentalObjectRow[]>(
          // Pages ROWS while totalCount counts DISTINCT hyresid. Verified 1:1
          // across the whole stock; if a column ever multiplies rows, paging
          // breaks first — dedupeByRentalId below guards the rows, not this.
          Prisma.sql`
            ${OBJECT_SELECT}
            ${from}
            ORDER BY b.hyresid
            OFFSET ${offset} ROWS FETCH NEXT ${params.limit} ROWS ONLY
          `
        )
        .then(trimStrings),
    ])

    return {
      rows: dedupeByRentalId(rows),
      totalCount: Number(countRows[0]?.total ?? 0),
    }
  } catch (err) {
    logger.error({ err }, 'rental-object-adapter.searchRentalObjects')
    throw err
  }
}
