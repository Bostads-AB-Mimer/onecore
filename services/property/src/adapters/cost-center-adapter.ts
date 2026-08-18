import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { CostCenterSummary, CostCenterTree } from '@src/types/cost-center'

import { filterToOperatingCompanies } from './company-scope'
import { prisma } from './db'
import { buildPropertySubtrees } from './property-subtree-adapter'

/**
 * Cost-center membership: which properties belong to this cost center's KVV
 * areas. Deliberately NOT cached — it is a single cheap query against our own
 * tables, and reading it fresh keeps admin edits correct immediately without
 * any invalidation logic. The expensive half (everything below the property
 * level) is cached by the property-subtree adapter.
 */
export const getCostCenterTreeById = async (
  id: string
): Promise<CostCenterTree | null> => {
  try {
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

    const propertyCodes = costCenter.kvvAreas.flatMap((area) =>
      area.propertyLinks.map((link) => link.propertyCode)
    )
    // A property assigned to a KVV-area and sold afterwards stays linked in
    // our own table — nothing moves it out — so it would otherwise appear
    // here as a ghost with its tenants still attached.
    const operating = new Set(await filterToOperatingCompanies(propertyCodes))
    const subtrees = await buildPropertySubtrees([...operating])

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
