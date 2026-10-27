import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { CostCenterSummary, CostCenterTree } from '@src/types/cost-center'

import { filterToOperatingCompanies } from './company-scope'
import { prisma } from './db'
import { buildPropertySubtrees } from './property-subtree-adapter'

/**
 * Cost-center membership: the entity with its KVV areas, plus the property
 * codes that survive the operating-company filter — a property sold after
 * being linked stays in our own table, so unfiltered links would show ghosts
 * with their tenants still attached.
 *
 * Uncached HERE so /cost-centers/:id/tree shows admin edits immediately; the
 * /property-tree path caches this per root for 15 min (grouping adapter).
 * The expensive below-property half has its own cache (subtree adapter).
 */
export const fetchCostCenterMembership = async (id: string) => {
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

  const propertyCodes = await filterToOperatingCompanies(
    costCenter.kvvAreas.flatMap((area) =>
      area.propertyLinks.map((link) => link.propertyCode)
    )
  )
  return { costCenter, propertyCodes }
}

export const getCostCenterTreeById = async (
  id: string
): Promise<CostCenterTree | null> => {
  try {
    const membership = await fetchCostCenterMembership(id)
    if (!membership) return null

    const { costCenter, propertyCodes } = membership
    const subtrees = await buildPropertySubtrees(propertyCodes)

    return {
      id: costCenter.id,
      code: costCenter.code,
      name: costCenter.name,
      leadKeycloakUserId: costCenter.leadKeycloakUserId ?? null,
      deputyKeycloakUserId: costCenter.deputyKeycloakUserId ?? null,
      kvvAreas: costCenter.kvvAreas.map((area) => ({
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
