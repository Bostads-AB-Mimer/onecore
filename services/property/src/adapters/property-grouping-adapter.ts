import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { PropertyGrouping, PropertyTree } from '@src/types/property-tree'
import type {
  RentalObjectScopeParams,
  RentalObjectSummary,
} from '@src/types/rental-object'

import {
  filterToOperatingCompanies,
  OPERATING_COMPANY_CODES,
} from './company-scope'
import { prisma } from './db'
import {
  buildPropertyObjects,
  buildPropertySubtrees,
} from './property-subtree-adapter'
import { resolveStructurePropertyCodes } from './rental-object-adapter'

// Resolvers turning a grouping root into a set of property codes. Everything
// below the property level is identical across groupings and is built by the
// property-subtree adapter, so these are the only grouping-specific queries.
//
// Deliberately uncached: each is a single cheap query, and reading membership
// fresh keeps admin edits (and Xpand moves) correct immediately with no
// invalidation logic. The expensive half is what carries the cache.

interface MarketArea {
  id: string
  code: string
  name: string | null
}

const fetchMarketAreas = async (): Promise<MarketArea[]> => {
  try {
    const rows = await prisma.$queryRaw<
      { id: string; code: string; name: string | null }[]
    >`
      SELECT DISTINCT
        a.keybabya AS id,
        a.code     AS code,
        a.caption  AS name
      FROM dbo.babya a
      INNER JOIN dbo.bafst f ON f.keybabya = a.keybabya
      INNER JOIN dbo.babuf s ON s.keyobjfst = f.keycmobj
      WHERE s.deletemark = 0
        AND LTRIM(RTRIM(s.cmpcode)) IN
            (SELECT value FROM OPENJSON(${JSON.stringify(OPERATING_COMPANY_CODES)}))
      ORDER BY a.code
    `.then(trimStrings)
    return rows
  } catch (err) {
    logger.error({ err }, 'property-grouping-adapter.listMarketAreas')
    throw err
  }
}

// Marknadsområden change about as rarely as the hierarchy itself, but the
// query joins through babuf to answer "which areas hold live stock" — and the
// picker asks for every area's tree at once when searching. The promise is
// cached rather than the rows: 27 simultaneous callers must share one query,
// not each miss an empty cache and start their own.
const MARKET_AREA_CACHE_TTL_MS = 60 * 60 * 1000

let marketAreaCache:
  | { promise: Promise<MarketArea[]>; expiresAt: number }
  | undefined

export const clearMarketAreaCache = (): void => {
  marketAreaCache = undefined
}

/** Marknadsområde (babya) — a flat attribute on the property, not a hierarchy. */
export const listMarketAreas = (): Promise<MarketArea[]> => {
  const now = Date.now()
  if (!marketAreaCache || marketAreaCache.expiresAt <= now) {
    const promise = fetchMarketAreas()
    // Don't cache failures — the next request should retry.
    promise.catch(() => {
      marketAreaCache = undefined
    })
    marketAreaCache = { promise, expiresAt: now + MARKET_AREA_CACHE_TTL_MS }
  }
  return marketAreaCache.promise
}

/**
 * Property codes of one marknadsområde, keyed on babya.code (the value we
 * also store as an audience criterion). Buildings and markytor carry their
 * own keybabya, but the only disagreements in the data are erroneous rows, so
 * the property's value is authoritative.
 */
export const resolveMarketAreaPropertyCodes = async (
  areaCode: string
): Promise<string[]> => {
  try {
    const rows = await prisma.$queryRaw<{ propertyCode: string }[]>`
      SELECT DISTINCT s.fstcode AS propertyCode
      FROM dbo.babuf s
      INNER JOIN dbo.bafst f ON f.keycmobj = s.keyobjfst
      INNER JOIN dbo.babya a ON a.keybabya = f.keybabya
      WHERE s.deletemark = 0
        AND s.fstcode IS NOT NULL
        AND LTRIM(RTRIM(a.code)) = ${areaCode.trim()}
        AND LTRIM(RTRIM(s.cmpcode)) IN
            (SELECT value FROM OPENJSON(${JSON.stringify(OPERATING_COMPANY_CODES)}))
    `
    return rows.map((r) => r.propertyCode.trim())
  } catch (err) {
    logger.error(
      { err, areaCode },
      'property-grouping-adapter.resolveMarketAreaPropertyCodes'
    )
    throw err
  }
}

/** Property codes of one company — the source the sidebar already uses. */
export const resolveCompanyPropertyCodes = async (
  companyCode: string
): Promise<string[]> => {
  const code = companyCode.trim()
  if (!(OPERATING_COMPANY_CODES as readonly string[]).includes(code)) return []

  try {
    const rows = await prisma.$queryRaw<{ propertyCode: string }[]>`
      SELECT DISTINCT s.fstcode AS propertyCode
      FROM dbo.babuf s
      WHERE s.deletemark = 0
        AND s.fstcode IS NOT NULL
        AND LTRIM(RTRIM(s.cmpcode)) = ${code}
    `
    return rows.map((r) => r.propertyCode.trim())
  } catch (err) {
    logger.error(
      { err, companyCode },
      'property-grouping-adapter.resolveCompanyPropertyCodes'
    )
    throw err
  }
}

/** Property codes of one KVV-area — the level below a district. */
export const resolveKvvAreaPropertyCodes = async (
  kvvAreaId: string
): Promise<string[] | null> => {
  try {
    const area = await prisma.onecoreKvvArea.findUnique({
      where: { id: kvvAreaId },
      include: { propertyLinks: true },
    })
    if (!area) return null

    return filterToOperatingCompanies(
      area.propertyLinks.map((link) => link.propertyCode.trim())
    )
  } catch (err) {
    logger.error(
      { err, kvvAreaId },
      'property-grouping-adapter.resolveKvvAreaPropertyCodes'
    )
    throw err
  }
}

/** The property codes one grouping root covers, or null if it doesn't exist. */
const resolveRootPropertyCodes = async (
  grouping: PropertyGrouping,
  rootId: string
): Promise<string[] | null> => {
  if (grouping === 'costCenter') return resolveCostCenterPropertyCodes(rootId)
  if (grouping === 'marketArea') {
    const codes = await resolveMarketAreaPropertyCodes(rootId)
    return codes.length > 0 ? codes : null
  }
  const codes = await resolveCompanyPropertyCodes(rootId)
  return codes.length > 0 ? codes : null
}

/**
 * Every rental object under one grouping root. Served from the same cache as
 * the tree, for clients that filter and count locally rather than asking the
 * server per filter change. Returns null when the root does not exist.
 */
export const getRootRentalObjects = async (
  grouping: PropertyGrouping,
  rootId: string
): Promise<RentalObjectSummary[] | null> => {
  try {
    const codes = await resolveRootPropertyCodes(grouping, rootId)
    if (!codes) return null
    return buildPropertyObjects(codes)
  } catch (err) {
    logger.error(
      { err, grouping, rootId },
      'property-grouping-adapter.getRootRentalObjects'
    )
    throw err
  }
}

/**
 * The property codes the grouping-level scopes cover, plus whatever the caller
 * named directly. babuf has no cost-centre or market-area column, so those
 * become property codes before any object query runs. Unfiltered — every
 * caller below ends in filterToOperatingCompanies.
 */
const groupingPropertyCodes = async (
  params: RentalObjectScopeParams
): Promise<string[]> => {
  const resolved = await Promise.all([
    ...(params.costCenterIds ?? []).map((id) =>
      resolveCostCenterPropertyCodes(id)
    ),
    ...(params.kvvAreaIds ?? []).map((id) => resolveKvvAreaPropertyCodes(id)),
    ...(params.marketAreaCodes ?? []).map((code) =>
      resolveMarketAreaPropertyCodes(code)
    ),
  ])
  return [...(params.propertyCodes ?? []), ...resolved.flat()].filter(
    (code): code is string => !!code
  )
}

/**
 * Property codes for the search, which keeps buildings, trapphus,
 * parkeringsområden and individual objects as scopes of their own — widening
 * those to their whole property would return objects nobody selected.
 *
 * The company filter is redundant for a district or KVV-area scope, whose
 * resolvers already apply it, but it is the only guard on the property codes a
 * client sends directly. One cheap query on an already-narrowed set.
 */
export const resolveSearchPropertyCodes = async (
  params: RentalObjectScopeParams
): Promise<string[]> =>
  filterToOperatingCompanies(await groupingPropertyCodes(params))

/**
 * Every property a selection touches, at any level — what the details lookup
 * needs, since its cache is keyed per property. Ticking one trapphus therefore
 * costs its fastighet's details rather than its district's, and the values are
 * reused the moment the same fastighet appears in another selection.
 */
export const resolveDetailsPropertyCodes = async (
  params: RentalObjectScopeParams
): Promise<string[]> => {
  const [fromGrouping, fromStructure] = await Promise.all([
    groupingPropertyCodes(params),
    resolveStructurePropertyCodes(params),
  ])
  return filterToOperatingCompanies([...fromGrouping, ...fromStructure])
}

/**
 * A property tree for any grouping. Membership is resolved fresh per request;
 * everything below the property level comes from the shared (cached) builder.
 * Returns null when the root does not exist.
 */
export const getPropertyTree = async (
  grouping: PropertyGrouping,
  rootId: string
): Promise<PropertyTree | null> => {
  if (grouping === 'costCenter') {
    const costCenter = await prisma.onecoreCostCenter
      .findUnique({
        where: { id: rootId },
        include: { kvvAreas: { include: { propertyLinks: true } } },
      })
      .then(trimStrings)
    if (!costCenter) return null

    const codes = await filterToOperatingCompanies(
      costCenter.kvvAreas.flatMap((a) =>
        a.propertyLinks.map((l) => l.propertyCode)
      )
    )
    const subtrees = await buildPropertySubtrees(codes)

    return {
      grouping,
      id: costCenter.id,
      code: costCenter.code,
      name: costCenter.name,
      groups: costCenter.kvvAreas.map((area) => ({
        id: area.id,
        code: area.code,
        name: area.name ?? null,
        responsibleKeycloakUserId: area.responsibleKeycloakUserId ?? null,
        properties: area.propertyLinks.flatMap((link) => {
          const subtree = subtrees.get(link.propertyCode)
          return subtree ? [subtree] : []
        }),
      })),
    }
  }

  if (grouping === 'marketArea') {
    const areas = await listMarketAreas()
    const area = areas.find((a) => a.code === rootId.trim())
    if (!area) return null

    const codes = await resolveMarketAreaPropertyCodes(area.code)
    const subtrees = await buildPropertySubtrees(codes)
    return {
      grouping,
      id: area.id,
      code: area.code,
      name: area.name,
      // No intermediate level — one group mirroring the root.
      groups: [
        {
          id: area.id,
          code: area.code,
          name: area.name,
          responsibleKeycloakUserId: null,
          properties: [...subtrees.values()],
        },
      ],
    }
  }

  const code = rootId.trim()
  const codes = await resolveCompanyPropertyCodes(code)
  if (codes.length === 0) return null
  const subtrees = await buildPropertySubtrees(codes)
  return {
    grouping,
    id: code,
    code,
    name: null,
    groups: [
      {
        id: code,
        code,
        name: null,
        responsibleKeycloakUserId: null,
        properties: [...subtrees.values()],
      },
    ],
  }
}

/** Property codes of one cost center, via our own KVV-area links. */
export const resolveCostCenterPropertyCodes = async (
  costCenterId: string
): Promise<string[] | null> => {
  try {
    const costCenter = await prisma.onecoreCostCenter.findUnique({
      where: { id: costCenterId },
      include: { kvvAreas: { include: { propertyLinks: true } } },
    })
    if (!costCenter) return null

    const codes = costCenter.kvvAreas.flatMap((area) =>
      area.propertyLinks.map((link) => link.propertyCode.trim())
    )
    return filterToOperatingCompanies(codes)
  } catch (err) {
    logger.error(
      { err, costCenterId },
      'property-grouping-adapter.resolveCostCenterPropertyCodes'
    )
    throw err
  }
}
