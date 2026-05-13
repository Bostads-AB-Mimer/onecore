import { PrismaClient } from '@prisma/client'
import { components } from '@onecore/types'

const prisma = new PrismaClient()
const { SURFACE_CATEGORY_NAME } = components
// Seeds the Ytskikt hierarchy for dev/test environments.
// Production environments populate this via the admin UI or the
// component-import script (separate work in progress).
// Deterministic UUIDs so re-running the seed is a no-op via upsert.
const ID = {
  category: {
    ytskikt: '00000000-0000-0000-0000-000000000001',
  },
  type: {
    vagg: '00000000-0000-0000-0000-000000000002',
    golv: '00000000-0000-0000-0000-000000000003',
    tak: '00000000-0000-0000-0000-000000000004',
  },
  subtype: {
    vaggOspecificerad: '00000000-0000-0000-0000-000000000005',
    vaggMalad: '00000000-0000-0000-0000-000000000006',
    vaggTapetserad: '00000000-0000-0000-0000-000000000007',
    vaggKakel: '00000000-0000-0000-0000-000000000008',
    golvOspecificerat: '00000000-0000-0000-0000-000000000009',
    golvParkett: '00000000-0000-0000-0000-00000000000a',
    golvLaminat: '00000000-0000-0000-0000-00000000000b',
    golvKlinker: '00000000-0000-0000-0000-00000000000c',
    golvPlastmatta: '00000000-0000-0000-0000-00000000000d',
    takOspecificerat: '00000000-0000-0000-0000-00000000000e',
    takMalat: '00000000-0000-0000-0000-00000000000f',
    takPanel: '00000000-0000-0000-0000-000000000010',
  },
  model: {
    vaggOspecificerad: '00000000-0000-0000-0000-000000000011',
    vaggMalad: '00000000-0000-0000-0000-000000000012',
    vaggTapetserad: '00000000-0000-0000-0000-000000000013',
    vaggKakel: '00000000-0000-0000-0000-000000000014',
    golvOspecificerat: '00000000-0000-0000-0000-000000000015',
    golvParkett: '00000000-0000-0000-0000-000000000016',
    golvLaminat: '00000000-0000-0000-0000-000000000017',
    golvKlinker: '00000000-0000-0000-0000-000000000018',
    golvPlastmatta: '00000000-0000-0000-0000-000000000019',
    takOspecificerat: '00000000-0000-0000-0000-00000000001a',
    takMalat: '00000000-0000-0000-0000-00000000001b',
    takPanel: '00000000-0000-0000-0000-00000000001c',
  },
} as const

type SubtypeSeed = {
  id: string
  modelId: string
  subTypeName: string
}

const vaggSubtypes: SubtypeSeed[] = [
  {
    id: ID.subtype.vaggOspecificerad,
    modelId: ID.model.vaggOspecificerad,
    subTypeName: 'Ospecificerad',
  },
  {
    id: ID.subtype.vaggMalad,
    modelId: ID.model.vaggMalad,
    subTypeName: 'Målad vägg',
  },
  {
    id: ID.subtype.vaggTapetserad,
    modelId: ID.model.vaggTapetserad,
    subTypeName: 'Tapetserad vägg',
  },
  {
    id: ID.subtype.vaggKakel,
    modelId: ID.model.vaggKakel,
    subTypeName: 'Kakel',
  },
]

const golvSubtypes: SubtypeSeed[] = [
  {
    id: ID.subtype.golvOspecificerat,
    modelId: ID.model.golvOspecificerat,
    subTypeName: 'Ospecificerat',
  },
  {
    id: ID.subtype.golvParkett,
    modelId: ID.model.golvParkett,
    subTypeName: 'Parkett',
  },
  {
    id: ID.subtype.golvLaminat,
    modelId: ID.model.golvLaminat,
    subTypeName: 'Laminat',
  },
  {
    id: ID.subtype.golvKlinker,
    modelId: ID.model.golvKlinker,
    subTypeName: 'Klinker',
  },
  {
    id: ID.subtype.golvPlastmatta,
    modelId: ID.model.golvPlastmatta,
    subTypeName: 'Plastmatta',
  },
]

const takSubtypes: SubtypeSeed[] = [
  {
    id: ID.subtype.takOspecificerat,
    modelId: ID.model.takOspecificerat,
    subTypeName: 'Ospecificerat',
  },
  {
    id: ID.subtype.takMalat,
    modelId: ID.model.takMalat,
    subTypeName: 'Målat tak',
  },
  {
    id: ID.subtype.takPanel,
    modelId: ID.model.takPanel,
    subTypeName: 'Panel',
  },
]

async function upsertSubtype(typeId: string, seed: SubtypeSeed) {
  return prisma.componentSubtypes.upsert({
    where: { id: seed.id },
    create: {
      id: seed.id,
      typeId,
      subTypeName: seed.subTypeName,
      quantityType: 'UNIT',
      depreciationPrice: 0,
      technicalLifespan: 0,
      economicLifespan: 0,
      replacementIntervalMonths: 0,
    },
    update: {},
  })
}

async function upsertModel(seed: SubtypeSeed) {
  return prisma.componentModels.upsert({
    where: { id: seed.modelId },
    create: {
      id: seed.modelId,
      modelName: seed.subTypeName,
      componentSubtypeId: seed.id,
      currentPrice: 0,
      currentInstallPrice: 0,
      warrantyMonths: 0,
      manufacturer: '',
    },
    update: {},
  })
}

async function main() {
  console.log('Seeding Ytskikt hierarchy...')

  const category = await prisma.componentCategories.upsert({
    where: { id: ID.category.ytskikt },
    create: {
      id: ID.category.ytskikt,
      categoryName: SURFACE_CATEGORY_NAME,
      description: SURFACE_CATEGORY_NAME,
    },
    // Reconcile labels on re-run so admins running the seed get the latest
    // user-facing strings without manual SQL.
    update: {
      categoryName: SURFACE_CATEGORY_NAME,
      description: SURFACE_CATEGORY_NAME,
    },
  })
  console.log('  Category:', category.categoryName)

  const types = [
    { id: ID.type.vagg, typeName: 'Vägg', description: 'Vägg' },
    { id: ID.type.golv, typeName: 'Golv', description: 'Golv' },
    { id: ID.type.tak, typeName: 'Tak', description: 'Tak' },
  ]
  for (const t of types) {
    await prisma.componentTypes.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        categoryId: ID.category.ytskikt,
        typeName: t.typeName,
        description: t.description,
      },
      update: { typeName: t.typeName, description: t.description },
    })
  }
  console.log('  Types: Vägg, Golv, Tak')

  const allSubtypes: Array<{ typeId: string; seed: SubtypeSeed }> = [
    ...vaggSubtypes.map((s) => ({ typeId: ID.type.vagg, seed: s })),
    ...golvSubtypes.map((s) => ({ typeId: ID.type.golv, seed: s })),
    ...takSubtypes.map((s) => ({ typeId: ID.type.tak, seed: s })),
  ]

  for (const { typeId, seed } of allSubtypes) {
    await upsertSubtype(typeId, seed)
  }
  console.log('  Subtypes:', allSubtypes.length)

  for (const { seed } of allSubtypes) {
    await upsertModel(seed)
  }
  console.log('  Models:', allSubtypes.length)

  console.log('Seed completed successfully.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
