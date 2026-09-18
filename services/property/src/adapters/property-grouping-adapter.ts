import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { PropertyGrouping, PropertyTree } from '@src/types/property-tree'
import type {
  RentalObjectScopeParams,
  ResolvedScope,
} from '@src/types/rental-object'

import { cachedKeyed, cachedPromise } from '@src/utils/promise-cache'
import {
  resolvePropertyShares,
  splitPropertyTreeNode,
  type KvvAreaExceptionRow,
  type PropertyShare,
} from '@src/utils/property-shares'

import {
  filterToOperatingCompanies,
  isOperatingCompany,
  operatingCompanyFilter,
} from './company-scope'
import { fetchCostCenterMembership } from './cost-center-adapter'
import { prisma } from './db'
import { getKvvAreaExceptions } from './kvv-area-adapter'
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

// No caller yet — kept so core can grow a flush hook without a service change.
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

/** Property shares of one KVV-area — the level below a district. Split
 * properties contribute only this area's side (see property-shares). */
export const resolveKvvAreaPropertyShares = async (
  kvvAreaId: string,
  // Pass when resolving several areas at once, to load the table only once.
  exceptions?: KvvAreaExceptionRow[]
): Promise<PropertyShare[] | null> => {
  try {
    const area = await prisma.onecoreKvvArea.findUnique({
      where: { id: kvvAreaId },
      include: { propertyLinks: true },
    })
    if (!area) return null

    const linked = {
      id: area.id,
      propertyCodes: area.propertyLinks.map((link) => link.propertyCode.trim()),
    }
    const shares =
      resolvePropertyShares(
        [linked],
        exceptions ?? (await getKvvAreaExceptions())
      ).get(area.id) ?? []
    const operating = new Set(
      await filterToOperatingCompanies(shares.map((s) => s.propertyCode))
    )
    return shares.filter((share) => operating.has(share.propertyCode))
  } catch (err) {
    logger.error(
      { err, kvvAreaId },
      'property-grouping-adapter.resolveKvvAreaPropertyShares'
    )
    throw err
  }
}

/** Property shares of one cost center, via our own KVV-area links. */
export const resolveCostCenterPropertyShares = async (
  costCenterId: string
): Promise<PropertyShare[] | null> => {
  try {
    const membership = await fetchCostCenterMembership(costCenterId)
    return membership
      ? membership.areas.flatMap((area) => area.properties)
      : null
  } catch (err) {
    logger.error(
      { err, costCenterId },
      'property-grouping-adapter.resolveCostCenterPropertyShares'
    )
    throw err
  }
}

/** The shares the grouping scopes cover plus directly named (whole) properties.
 * Unfiltered — every caller below ends in filterToOperatingCompanies. */
const groupingPropertyShares = async (
  params: RentalObjectScopeParams
): Promise<PropertyShare[]> => {
  // One resolve per area: a whole area (null = every share) and any
  // `<kvvAreaId>:<propertyCode>` shares of it come from the same result.
  const codesByArea = new Map<string, Set<string> | null>()
  for (const id of params.kvvAreaIds ?? []) codesByArea.set(id, null)
  for (const value of params.propertyShares ?? []) {
    const at = value.indexOf(':')
    const areaId = value.slice(0, at)
    const codes = codesByArea.get(areaId)
    if (codes === null) continue
    codesByArea.set(areaId, (codes ?? new Set()).add(value.slice(at + 1)))
  }

  const exceptions =
    codesByArea.size > 0 ? await getKvvAreaExceptions() : undefined

  const resolved = await Promise.all([
    ...(params.costCenterIds ?? []).map((id) =>
      resolveCostCenterPropertyShares(id)
    ),
    ...Array.from(codesByArea).map(([areaId, codes]) =>
      resolveKvvAreaPropertyShares(areaId, exceptions).then((shares) =>
        codes
          ? (shares ?? []).filter((share) => codes.has(share.propertyCode))
          : shares
      )
    ),
    ...(params.marketAreaCodes ?? []).map((code) =>
      resolveMarketAreaPropertyCodes(code).then((codes) =>
        codes.map((propertyCode): PropertyShare => ({ propertyCode }))
      )
    ),
  ])
  return [
    ...(params.propertyCodes ?? []).map((propertyCode) => ({ propertyCode })),
    ...resolved.flat().filter((share): share is PropertyShare => !!share),
  ]
}

/** Search scope: structure levels stay scopes of their own; shares union up,
 * so a property covered whole anywhere drops its partial forms. */
export const resolveSearchScope = async (
  params: RentalObjectScopeParams
): Promise<ResolvedScope> => {
  const shares = await groupingPropertyShares(params)

  const whole = new Set<string>()
  const excludedByProperty = new Map<string, Set<string>>()
  const buildingCodes = new Set<string>()
  for (const share of shares) {
    const side = share.buildings
    if (!side) whole.add(share.propertyCode)
    else if ('include' in side)
      side.include.forEach((b) => buildingCodes.add(b))
    else {
      const excluded = excludedByProperty.get(share.propertyCode) ?? new Set()
      side.exclude.forEach((b) => excluded.add(b))
      excludedByProperty.set(share.propertyCode, excluded)
    }
  }

  // Only guard on client-sent codes; building codes need none, since
  // rentalObjectWhere cuts company 999 on every row.
  const operating = new Set(
    await filterToOperatingCompanies([...whole, ...excludedByProperty.keys()])
  )
  return {
    propertyCodes: [...whole].filter((code) => operating.has(code)),
    partialProperties: [...excludedByProperty]
      .filter(([code]) => operating.has(code) && !whole.has(code))
      .map(([propertyCode, excluded]) => ({
        propertyCode,
        excludedBuildingCodes: [...excluded],
      })),
    buildingCodes: [...buildingCodes],
  }
}

/** Every property a selection touches: the details cache is keyed per property,
 * so a trapphus or a share costs its whole fastighet, never its district. */
export const resolveDetailsPropertyCodes = async (
  params: RentalObjectScopeParams
): Promise<string[]> => {
  const [fromGrouping, fromStructure] = await Promise.all([
    groupingPropertyShares(params),
    resolveStructurePropertyCodes(params),
  ])
  return filterToOperatingCompanies([
    ...fromGrouping.map((share) => share.propertyCode),
    ...fromStructure,
  ])
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

    const { costCenter, areas, propertyCodes } = membership
    const nodes = await buildPropertyTreeNodes(propertyCodes, includeObjects)

    return {
      grouping,
      id: costCenter.id,
      code: costCenter.code,
      name: costCenter.name,
      groups: areas.map((area) => ({
        id: area.id,
        code: area.code,
        name: area.name,
        responsibleKeycloakUserId: area.responsibleKeycloakUserId,
        properties: area.properties.flatMap((share) => {
          const node = nodes.get(share.propertyCode)
          return node ? [splitPropertyTreeNode(node, share.buildings)] : []
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
