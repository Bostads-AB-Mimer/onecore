import { logger } from '@onecore/utilities'

import { prisma } from '../adapters/db'

// One-time snapshot seed from the Xpand mirror (bafen, babuf) into the
// OneCore-owned management-area tables. Idempotent: every write is an upsert
// keyed on the natural unique column (code / property_code).

async function seedCostCenters(): Promise<{
  costCenterIdByTypeId: Map<string, string>
  upserted: number
}> {
  // Cost centers live on AdministrativeUnitType (bafet): `code` is the
  // numeric kostnadsställe-nummer (e.g. "61110") and `name` is the caption
  // (e.g. "Distrikt Mitt"). We seed only the types that are actually
  // referenced by an active AdministrativeUnit with a district set.
  const refs = await prisma.administrativeUnit.findMany({
    where: {
      district: { not: null },
      deleteMark: 0,
      administrativeUnitTypeId: { not: null },
    },
    select: { administrativeUnitTypeId: true },
    distinct: ['administrativeUnitTypeId'],
  })

  const typeIds = refs
    .map((r) => r.administrativeUnitTypeId)
    .filter((id): id is string => id !== null)

  const types = await prisma.administrativeUnitType.findMany({
    where: { id: { in: typeIds } },
    select: { id: true, code: true, name: true },
  })

  const costCenterIdByTypeId = new Map<string, string>()
  let upserted = 0

  for (const type of types) {
    const code = type.code?.trim()
    if (!code) continue
    const name = type.name?.trim() ?? code

    const record = await prisma.onecoreCostCenter.upsert({
      where: { code },
      create: { code, name },
      update: { name },
      select: { id: true },
    })
    costCenterIdByTypeId.set(type.id, record.id)
    upserted += 1
  }

  return { costCenterIdByTypeId, upserted }
}

async function seedKvvAreas(
  costCenterIdByTypeId: Map<string, string>
): Promise<{
  codeToId: Map<string, string>
  upserted: number
  skipped: number
}> {
  const rows = await prisma.administrativeUnit.findMany({
    where: { district: { not: null }, deleteMark: 0 },
    select: { code: true, administrativeUnitTypeId: true },
  })

  const codeToId = new Map<string, string>()
  let upserted = 0
  let skipped = 0

  for (const row of rows) {
    const code = row.code?.trim()
    const typeId = row.administrativeUnitTypeId
    if (!code || !typeId) {
      skipped += 1
      continue
    }
    const costCenterId = costCenterIdByTypeId.get(typeId)
    if (!costCenterId) {
      skipped += 1
      continue
    }

    const record = await prisma.onecoreKvvArea.upsert({
      where: { code },
      create: { code, costCenterId },
      update: { costCenterId },
      select: { id: true, code: true },
    })
    codeToId.set(record.code, record.id)
    upserted += 1
  }

  return { codeToId, upserted, skipped }
}

async function seedPropertyKvvAreas(
  kvvAreaByCode: Map<string, string>
): Promise<{
  upserted: number
  skipped: number
}> {
  const rows = await prisma.propertyStructure.findMany({
    where: {
      deleteMark: 0,
      managementUnitCode: { not: null },
      propertyCode: { not: null },
    },
    select: { propertyCode: true, managementUnitCode: true },
    distinct: ['propertyCode'],
  })

  let upserted = 0
  let skipped = 0

  for (const row of rows) {
    const propertyCode = row.propertyCode?.trim()
    const managementUnitCode = row.managementUnitCode?.trim()
    if (!propertyCode || !managementUnitCode) {
      skipped += 1
      continue
    }
    const kvvAreaId = kvvAreaByCode.get(managementUnitCode)
    if (!kvvAreaId) {
      skipped += 1
      continue
    }

    await prisma.onecorePropertyKvvArea.upsert({
      where: { propertyCode },
      create: { propertyCode, kvvAreaId },
      update: { kvvAreaId },
    })
    upserted += 1
  }

  return { upserted, skipped }
}

async function main(): Promise<void> {
  const costCenters = await seedCostCenters()
  const kvvAreas = await seedKvvAreas(costCenters.costCenterIdByTypeId)
  const propertyLinks = await seedPropertyKvvAreas(kvvAreas.codeToId)

  logger.info(
    {
      costCentersUpserted: costCenters.upserted,
      kvvAreasUpserted: kvvAreas.upserted,
      kvvAreasSkipped: kvvAreas.skipped,
      propertyLinksUpserted: propertyLinks.upserted,
      propertyLinksSkipped: propertyLinks.skipped,
    },
    'seedPropertyAreas.done'
  )
}

main()
  .catch((err) => {
    logger.error({ err }, 'seedPropertyAreas')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
