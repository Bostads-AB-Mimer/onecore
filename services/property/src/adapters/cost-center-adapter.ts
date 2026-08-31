import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import {
  resolvePropertyShares,
  splitPropertySubtree,
  type PropertyShare,
} from '@src/utils/property-shares'
import type { CostCenterSummary, CostCenterTree } from '@src/types/cost-center'

import { filterToOperatingCompanies } from './company-scope'
import { prisma } from './db'
import { getKvvAreaExceptions } from './kvv-area-adapter'
import { buildPropertySubtrees } from './property-subtree-adapter'

export type CostCenterMembership = {
  costCenter: {
    id: string
    code: string
    name: string
    leadKeycloakUserId: string | null
    deputyKeycloakUserId: string | null
  }
  areas: Array<{
    id: string
    code: string
    name: string | null
    responsibleKeycloakUserId: string | null
    properties: PropertyShare[]
  }>
  /** Every property some share covers, operating-company filtered. */
  propertyCodes: string[]
}

/**
 * Cost-center membership: the entity with its KVV areas, each holding the
 * property SHARES it covers — whole properties via the link table, and for
 * split properties (building-level KVV-area exceptions) only its side.
 * Shares are operating-company filtered: a property sold after being linked
 * stays in our own table, so unfiltered links would show ghosts with their
 * tenants still attached.
 *
 * Uncached HERE so /cost-centers/:id/tree shows admin edits immediately; the
 * /property-tree path caches this per root for 15 min (grouping adapter).
 * The expensive below-property half has its own cache (subtree adapter).
 */
export const fetchCostCenterMembership = async (
  id: string
): Promise<CostCenterMembership | null> => {
  const costCenter = await prisma.onecoreCostCenter
    .findUnique({
      where: { id },
      include: {
        kvvAreas: {
          include: { propertyLinks: true },
        },
      },
    })
    .then(trimStrings)

  if (!costCenter) return null

  const linkedAreas = costCenter.kvvAreas.map((area) => ({
    id: area.id,
    propertyCodes: area.propertyLinks.map((link) => link.propertyCode),
  }))
  const exceptions = await getKvvAreaExceptions({
    kvvAreaIds: linkedAreas.map((area) => area.id),
    propertyCodes: linkedAreas.flatMap((area) => area.propertyCodes),
  })
  const sharesByArea = resolvePropertyShares(linkedAreas, exceptions)

  const propertyCodes = await filterToOperatingCompanies(
    Array.from(sharesByArea.values()).flatMap((shares) =>
      shares.map((share) => share.propertyCode)
    )
  )
  const operating = new Set(propertyCodes)

  return {
    costCenter: {
      id: costCenter.id,
      code: costCenter.code,
      name: costCenter.name,
      leadKeycloakUserId: costCenter.leadKeycloakUserId ?? null,
      deputyKeycloakUserId: costCenter.deputyKeycloakUserId ?? null,
    },
    areas: costCenter.kvvAreas.map((area) => ({
      id: area.id,
      code: area.code,
      name: area.name ?? null,
      responsibleKeycloakUserId: area.responsibleKeycloakUserId ?? null,
      properties: (sharesByArea.get(area.id) ?? []).filter((share) =>
        operating.has(share.propertyCode)
      ),
    })),
    propertyCodes,
  }
}

export const getCostCenterTreeById = async (
  id: string
): Promise<CostCenterTree | null> => {
  try {
    const membership = await fetchCostCenterMembership(id)
    if (!membership) return null

    const { costCenter, areas, propertyCodes } = membership
    const subtrees = await buildPropertySubtrees(propertyCodes)

    return {
      ...costCenter,
      kvvAreas: areas.map((area) => ({
        id: area.id,
        code: area.code,
        name: area.name,
        responsibleKeycloakUserId: area.responsibleKeycloakUserId,
        properties: area.properties.flatMap((share) => {
          const subtree = subtrees.get(share.propertyCode)
          return subtree ? [splitPropertySubtree(subtree, share.buildings)] : []
        }),
      })),
    }
  } catch (err) {
    logger.error({ err, id }, 'cost-center-adapter.getCostCenterTreeById')
    throw err
  }
}

export const listCostCenters = async (): Promise<CostCenterSummary[]> => {
  try {
    const rows = await prisma.onecoreCostCenter
      .findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      })
      .then(trimStrings)
    return rows
  } catch (err) {
    logger.error({ err }, 'cost-center-adapter.listCostCenters')
    throw err
  }
}
