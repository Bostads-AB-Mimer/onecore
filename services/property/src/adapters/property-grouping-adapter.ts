import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { PropertyGrouping, PropertyTree } from '@src/types/property-tree'
import type { RentalObjectScopeParams } from '@src/types/rental-object'

import { cachedKeyed, cachedPromise } from '@src/utils/promise-cache'

import {
  filterToOperatingCompanies,
  isOperatingCompany,
  operatingCompanyFilter,
} from './company-scope'
import { fetchCostCenterMembership } from './cost-center-adapter'
import { prisma } from './db'
import { buildPropertyTreeNodes } from './property-subtree-adapter'
import { resolveStructurePropertyCodes } from './rental-object-adapter'

// Resolvers turning a grouping root into a set of property codes. Everything
// below the property level is identical across groupings and is built by the
// property-subtree adapter, so these are the only grouping-specific queries.
//
// The tree path caches membership per root: the queries measured as ~90% of
// a warm tree request. A KVV/area move can thus lag up to the TTL; the
// search and details resolvers still read fresh.

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
        AND ${operatingCompanyFilter('s.cmpcode')}
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

const marketAreaCache = cachedPromise(
  MARKET_AREA_CACHE_TTL_MS,
  fetchMarketAreas
)

export const clearMarketAreaCache = (): void => marketAreaCache.clear()

/** Marknadsområde (babya) — a flat attribute on the property, not a hierarchy. */
export const listMarketAreas = (): Promise<MarketArea[]> =>
  marketAreaCache.get()

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
        AND ${operatingCompanyFilter('s.cmpcode')}
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
  if (!isOperatingCompany(code)) return []

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

/** Property codes of one cost center, via our own KVV-area links. */
export const resolveCostCenterPropertyCodes = async (
  costCenterId: string
): Promise<string[] | null> => {
  try {
    const membership = await fetchCostCenterMembership(costCenterId)
    return membership ? membership.propertyCodes : null
  } catch (err) {
    logger.error(
      { err, costCenterId },
      'property-grouping-adapter.resolveCostCenterPropertyCodes'
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

// Shorter than the subtree cache's hour: membership is what an admin edit
// moves, so its staleness window is the one users actually notice.
const MEMBERSHIP_CACHE_TTL_MS = 15 * 60 * 1000

const costCenterMembershipCache = cachedKeyed(
  MEMBERSHIP_CACHE_TTL_MS,
  fetchCostCenterMembership
)
const marketAreaCodesCache = cachedKeyed(
  MEMBERSHIP_CACHE_TTL_MS,
  resolveMarketAreaPropertyCodes
)
const fetchCompanyMembership = async (code: string) => {
  const [codes, company] = await Promise.all([
    resolveCompanyPropertyCodes(code),
    prisma.company
      .findFirst({ where: { code }, select: { name: true } })
      .then(trimStrings),
  ])
  return { codes, name: company?.name ?? null }
}

// The largest tree (~263 properties) — a full babuf scan without this.
const companyMembershipCache = cachedKeyed(
  MEMBERSHIP_CACHE_TTL_MS,
  fetchCompanyMembership
)

/**
 * A property tree for any grouping. Membership is cached per root on a TTL;
 * everything below the property level comes from the shared (cached) builder.
 * Returns null when the root does not exist.
 */
export const getPropertyTree = async (
  grouping: PropertyGrouping,
  rootId: string,
  includeObjects = true
): Promise<PropertyTree | null> => {
  if (grouping === 'costCenter') {
    const membership = await costCenterMembershipCache.get(rootId)
    if (!membership) return null

    const { costCenter, propertyCodes } = membership
    const subtrees = await buildPropertyTreeNodes(propertyCodes, includeObjects)

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

    const codes = await marketAreaCodesCache.get(area.code)
    const subtrees = await buildPropertyTreeNodes(codes, includeObjects)
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
  // null is "no such root" — an existing but empty company answers an empty
  // tree, not a 404.
  if (!isOperatingCompany(code)) {
    return null
  }
  const { codes, name } = await companyMembershipCache.get(code)
  const subtrees = await buildPropertyTreeNodes(codes, includeObjects)
  return {
    grouping,
    id: code,
    code,
    name,
    groups: [
      {
        id: code,
        code,
        name,
        responsibleKeycloakUserId: null,
        properties: [...subtrees.values()],
      },
    ],
  }
}
