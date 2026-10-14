import { Prisma } from '@prisma/client'
import { property } from '@onecore/types'

export type ComponentListFilters = {
  modelId?: string
  withoutModel?: boolean
  notInstalled?: boolean
  subtypeId?: string
  status?: string
  serialNumber?: string
  specifications?: string
  installation?: property.ComponentInstallationFilter
  installedBefore?: number
}

export type ComponentListSort = {
  sortBy: property.ComponentSortKey
  sortOrder?: property.SortOrder
}

const DEFAULT_SORT: Required<ComponentListSort> = {
  sortBy: 'installed',
  sortOrder: 'desc',
}

const MIN_SEARCH_LENGTH = 2

// A constant, so it is inlined rather than bound: ORDER BY stays parameter free.
const FIRST_KNOWN_DATE = Prisma.raw(
  `'${property.FIRST_KNOWN_INSTALLATION_YEAR}-01-01'`
)

// component_installations has a filtered unique index on componentId where
// deinstallationDate IS NULL, so this join yields at most one row per component.
const FROM = Prisma.sql`
  FROM dbo.components c
  LEFT JOIN dbo.component_installations i
    ON i.componentId = c.id AND i.deinstallationDate IS NULL
  LEFT JOIN dbo.component_models m ON m.id = c.modelId
`

const likePattern = (search: string) =>
  `%${search.replace(/[[%_]/g, (char) => `[${char}]`)}%`

const searchTerm = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : undefined
}

const whereSql = (filters: ComponentListFilters) => {
  const conditions: Prisma.Sql[] = []

  if (filters.subtypeId)
    conditions.push(Prisma.sql`c.subtypeId = ${filters.subtypeId}`)
  if (filters.modelId)
    conditions.push(Prisma.sql`c.modelId = ${filters.modelId}`)
  if (filters.withoutModel) conditions.push(Prisma.sql`c.modelId IS NULL`)
  if (filters.status) conditions.push(Prisma.sql`c.status = ${filters.status}`)

  const serialNumber = searchTerm(filters.serialNumber)
  if (serialNumber) {
    conditions.push(
      Prisma.sql`c.serialNumber LIKE ${likePattern(serialNumber)}`
    )
  }
  const specifications = searchTerm(filters.specifications)
  if (specifications) {
    conditions.push(
      Prisma.sql`c.specifications LIKE ${likePattern(specifications)}`
    )
  }

  const installation = filters.notInstalled
    ? 'notInstalled'
    : filters.installation
  if (installation === 'installed')
    conditions.push(Prisma.sql`i.id IS NOT NULL`)
  if (installation === 'notInstalled') conditions.push(Prisma.sql`i.id IS NULL`)
  if (installation === 'unknownDate') {
    conditions.push(
      Prisma.sql`i.id IS NOT NULL AND (i.installationDate IS NULL OR i.installationDate < ${FIRST_KNOWN_DATE})`
    )
  }

  if (filters.installedBefore) {
    conditions.push(
      Prisma.sql`i.installationDate >= ${FIRST_KNOWN_DATE} AND i.installationDate < ${`${filters.installedBefore}-01-01`}`
    )
  }

  return conditions.length > 0
    ? Prisma.join(conditions, ' AND ')
    : Prisma.sql`1 = 1`
}

const blankLast = (column: string) =>
  Prisma.raw(`CASE WHEN NULLIF(LTRIM(${column}), '') IS NULL THEN 1 ELSE 0 END`)

// Blank text sorts as NULL, so all blanks tie and fall back to the id.
const swedishText = (column: string, direction: Prisma.Sql) =>
  Prisma.sql`${blankLast(column)}, ${Prisma.raw(`NULLIF(LTRIM(${column}), '')`)} COLLATE Finnish_Swedish_CI_AS ${direction}`

// Mirrors formatComponentModelName in property-tree: the manufacturer, unless it
// is the import's 'Unknown' placeholder, then the model name.
const MODEL_LABEL = `CONCAT(CASE WHEN m.manufacturer COLLATE Latin1_General_CS_AS <> 'Unknown' THEN m.manufacturer + ' ' END, m.modelName)`

const orderBySql = (sort: ComponentListSort | undefined) => {
  const { sortBy, sortOrder = 'asc' } = sort ?? DEFAULT_SORT
  const direction = Prisma.raw(sortOrder === 'desc' ? 'DESC' : 'ASC')

  switch (sortBy) {
    case 'installed':
      return Prisma.sql`CASE WHEN i.installationDate >= ${FIRST_KNOWN_DATE} THEN 0 ELSE 1 END, CASE WHEN i.installationDate >= ${FIRST_KNOWN_DATE} THEN i.installationDate END ${direction}`
    case 'model':
      return swedishText(MODEL_LABEL, direction)
    case 'serialNumber':
      return swedishText('c.serialNumber', direction)
    case 'specifications':
      return swedishText('c.specifications', direction)
    case 'quantity':
      return Prisma.sql`CASE WHEN c.quantity > 0 THEN 0 ELSE 1 END, c.quantity ${direction}`
  }
}

export const componentPageSql = (
  filters: ComponentListFilters,
  sort: ComponentListSort | undefined,
  skip: number,
  take: number
) => Prisma.sql`
  SELECT c.id
  ${FROM}
  WHERE ${whereSql(filters)}
  ORDER BY ${orderBySql(sort)}, c.id ASC
  OFFSET ${skip} ROWS FETCH NEXT ${take} ROWS ONLY
`

export const componentCountSql = (filters: ComponentListFilters) => Prisma.sql`
  SELECT COUNT(*) AS total
  ${FROM}
  WHERE ${whereSql(filters)}
`
