import { logger } from '@onecore/utilities'

import { prisma } from '../adapters/db'

// One-off, idempotent backfill of onecore_kvv_area.name from the Xpand mirror
// (bafen.caption, mapped to AdministrativeUnit.name). The original seed never
// set names. Deliberately touches ONLY rows with name IS NULL and nothing else:
// re-running seed-property-areas.ts would also re-upsert property links and
// overwrite moves made in the Förvaltningsområden UI.
//
// Run per environment: `pnpm run backfill:kvv-area-names` in services/property.

export async function backfillKvvAreaNames(): Promise<{
  updated: number
  skipped: number
}> {
  const unnamed = await prisma.onecoreKvvArea.findMany({
    where: { name: null },
    select: { id: true, code: true },
  })
  if (unnamed.length === 0) return { updated: 0, skipped: 0 }

  // bafen.code is NOT unique (plain index, and the table holds soft-deleted
  // rows), so mirror seed-property-areas.ts exactly: without these filters a
  // deleted duplicate can win the map below and write the wrong caption — and
  // this script could never repair it, since it only touches `name IS NULL`.
  const units = await prisma.administrativeUnit.findMany({
    where: {
      code: { in: unnamed.map((a) => a.code) },
      deleteMark: 0,
      district: { not: null },
    },
    select: { code: true, name: true },
  })
  const captionByCode = new Map(
    units.map((u) => [u.code.trim(), u.name?.trim() || null])
  )

  let updated = 0
  let skipped = 0
  for (const area of unnamed) {
    const name = captionByCode.get(area.code.trim())
    if (!name) {
      skipped += 1
      continue
    }
    await prisma.onecoreKvvArea.update({
      where: { id: area.id },
      data: { name },
    })
    updated += 1
  }

  return { updated, skipped }
}

async function main(): Promise<void> {
  const result = await backfillKvvAreaNames()
  logger.info(result, 'backfillKvvAreaNames.done')
}

if (require.main === module) {
  main()
    .catch((err) => {
      logger.error({ err }, 'backfillKvvAreaNames')
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
