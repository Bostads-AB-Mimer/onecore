import { logger } from '@onecore/utilities'

import { prisma } from '../adapters/db'

// One-time snapshot seed from the Xpand mirror (bafen, babuf) into the
// OneCore-owned management-area tables. Idempotent: every write is an upsert
// keyed on the natural unique column (code / property_code).

async function seedCostCenters(): Promise<{
  codeToId: Map<string, string>
  upserted: number
}> {
  const rows = await prisma.administrativeUnit.findMany({
    where: { district: { not: null }, deleteMark: 0 },
    select: { district: true },
    distinct: ['district'],
  })

  const codeToId = new Map<string, string>()
  let upserted = 0

  for (const row of rows) {
    const district = row.district?.trim()
    if (!district) continue

    const record = await prisma.onecoreCostCenter.upsert({
      where: { code: district },
      create: { code: district, name: district },
      update: { name: district },
      select: { id: true, code: true },
    })
    codeToId.set(record.code, record.id)
    upserted += 1
  }

  return { codeToId, upserted }
}

async function seedKvvAreas(costCenterByCode: Map<string, string>): Promise<{
  codeToId: Map<string, string>
  upserted: number
  skipped: number
}> {
  const rows = await prisma.administrativeUnit.findMany({
    where: { district: { not: null }, deleteMark: 0 },
    select: { code: true, district: true },
  })

  const codeToId = new Map<string, string>()
  let upserted = 0
  let skipped = 0

  for (const row of rows) {
    const district = row.district?.trim()
    const code = row.code?.trim()
    if (!district || !code) {
      skipped += 1
      continue
    }
    const costCenterId = costCenterByCode.get(district)
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
  const kvvAreas = await seedKvvAreas(costCenters.codeToId)
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
