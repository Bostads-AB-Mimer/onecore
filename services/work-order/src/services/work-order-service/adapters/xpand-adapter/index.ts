import knex from 'knex'
import { logger } from '@onecore/utilities'
import Config from '../../../../common/config'
import { AdapterResult } from '../../types'
import {
  XpandWorkOrder,
  XpandWorkOrderDetails,
  XpandWorkOrderDetailsSchema,
  XpandWorkOrderSchema,
} from '../../schemas'
import {
  transformXpandDbWorkOrder,
  transformXpandDbWorkOrderDetails,
  trimStrings,
} from './utils'

export interface XpandDbWorkOrder {
  code: string
  caption: string | null
  contactCode: string | null
  masterKey: string
  status: number
  resource: string
  resourceGroup: string
  createdAt: Date
  expiresAt: Date | null
  lastChanged: Date
  priority: string | null
  residenceId: string
}

export interface XpandDbWorkOrderDetails extends XpandDbWorkOrder {
  rows: string // Fetched as JSON string
}

export const db = knex({
  client: 'mssql',
  connection: Config.xpandDatabase,
  pool: {
    min: 0,
    max: 20,
    idleTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
  },
})

export async function getWorkOrdersByContactCode(
  contactCode: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'schema-error' | 'unknown'>> {
  logger.info(`Getting work orders for contactCode: ${contactCode}`)

  const workOrders = await db<XpandDbWorkOrder>('aoupp')
    .select(
      'aoupp.code',
      'aoupp.caption AS caption',
      'cmctc.cmctckod AS contactCode',
      'aotlt.caption AS masterKey',
      'aoupp.status AS status',
      'resource.cmctcben AS resource',
      'cmrgr.caption AS resourceGroup',
      'aoupp.time AS createdAt',
      'aoupp.timeforf AS expiresAt',
      'aoupp.lastchged AS lastChanged',
      'aopri.code AS priority',
      'babuf.hyresid AS residenceId'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'aoupp.keycmobj')
    .innerJoin('aotlt', 'aotlt.keyaotlt', 'aoupp.keyaotlt')
    .leftJoin('cmctc', 'cmctc.keycmctc', 'aoupp.keycmctc')
    .leftJoin('cmctc as resource', 'resource.keycmctc', 'aoupp.keycmctc2')
    .leftJoin('cmrgr', 'cmrgr.keycmrgr', 'aoupp.keycmrgr')
    .leftJoin('aopri', 'aopri.keyaopri', 'aoupp.keyaopri')
    .where('cmctc.cmctckod', contactCode)
    .orderBy('aoupp.time', sortAscending ? 'asc' : 'desc')
    .offset(skip)
    .limit(limit)
    .then<XpandDbWorkOrder[]>(trimStrings)

  const transformedWorkOrders = workOrders.map(transformXpandDbWorkOrder)

  const parsed = XpandWorkOrderSchema.array().safeParse(transformedWorkOrders)
  if (!parsed.success) {
    logger.error(
      { error: parsed.error.format() },
      'Failed to parse work orders from Xpand DB'
    )

    return { ok: false, err: 'schema-error' }
  }

  return { ok: true, data: parsed.data }
}

export async function getWorkOrdersByResidenceId(
  residenceId: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'schema-error' | 'unknown'>> {
  logger.info(`Getting work orders for residenceId: ${residenceId}`)

  const workOrders = await db<XpandDbWorkOrder>('aoupp')
    .select(
      'aoupp.code',
      'aoupp.caption AS caption',
      'cmctc.cmctckod AS contactCode',
      'aotlt.caption AS masterKey',
      'aoupp.status AS status',
      'resource.cmctcben AS resource',
      'cmrgr.caption AS resourceGroup',
      'aoupp.time AS createdAt',
      'aoupp.timeforf AS expiresAt',
      'aoupp.lastchged AS lastChanged',
      'aopri.code AS priority',
      'babuf.hyresid AS residenceId'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'aoupp.keycmobj')
    .innerJoin('aotlt', 'aotlt.keyaotlt', 'aoupp.keyaotlt')
    .leftJoin('cmctc', 'cmctc.keycmctc', 'aoupp.keycmctc')
    .leftJoin('cmctc as resource', 'resource.keycmctc', 'aoupp.keycmctc2')
    .leftJoin('cmrgr', 'cmrgr.keycmrgr', 'aoupp.keycmrgr')
    .leftJoin('aopri', 'aopri.keyaopri', 'aoupp.keyaopri')
    .where('babuf.hyresid', residenceId)
    .orderBy('aoupp.time', sortAscending ? 'asc' : 'desc')
    .offset(skip)
    .limit(limit)
    .then<XpandDbWorkOrder[]>(trimStrings)

  const transformedWorkOrders = workOrders.map(transformXpandDbWorkOrder)

  const parsed = XpandWorkOrderSchema.array().safeParse(transformedWorkOrders)
  if (!parsed.success) {
    logger.error(
      { error: parsed.error.format() },
      'Failed to parse work orders from Xpand DB'
    )

    return { ok: false, err: 'schema-error' }
  }

  return { ok: true, data: parsed.data }
}

export async function getWorkOrdersByPropertyId(
  propertyId: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'schema-error' | 'unknown'>> {
  logger.info(`Getting work orders for propertyId: ${propertyId}`)

  const workOrders = await db<XpandDbWorkOrder>('aoupp')
    .select(
      'aoupp.code',
      'aoupp.caption AS caption',
      'cmctc.cmctckod AS contactCode',
      'aotlt.caption AS masterKey',
      'aoupp.status AS status',
      'resource.cmctcben AS resource',
      'cmrgr.caption AS resourceGroup',
      'aoupp.time AS createdAt',
      'aoupp.timeforf AS expiresAt',
      'aoupp.lastchged AS lastChanged',
      'aopri.code AS priority',
      'babuf.hyresid AS residenceId'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'aoupp.keycmobj')
    .innerJoin('aotlt', 'aotlt.keyaotlt', 'aoupp.keyaotlt')
    .leftJoin('cmctc', 'cmctc.keycmctc', 'aoupp.keycmctc')
    .leftJoin('cmctc as resource', 'resource.keycmctc', 'aoupp.keycmctc2')
    .leftJoin('cmrgr', 'cmrgr.keycmrgr', 'aoupp.keycmrgr')
    .leftJoin('aopri', 'aopri.keyaopri', 'aoupp.keyaopri')
    .where('babuf.code', propertyId)
    .orderBy('aoupp.time', sortAscending ? 'asc' : 'desc')
    .offset(skip)
    .limit(limit)
    .then<XpandDbWorkOrder[]>(trimStrings)

  const transformedWorkOrders = workOrders.map(transformXpandDbWorkOrder)

  const parsed = XpandWorkOrderSchema.array().safeParse(transformedWorkOrders)
  if (!parsed.success) {
    logger.error(
      { error: parsed.error.format() },
      'Failed to parse work orders from Xpand DB'
    )

    return { ok: false, err: 'schema-error' }
  }

  return { ok: true, data: parsed.data }
}

export async function getWorkOrdersByBuildingId(
  buildingId: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'schema-error' | 'unknown'>> {
  logger.info(`Getting work orders for buildingId: ${buildingId}`)

  const workOrders = await db<XpandDbWorkOrder>('aoupp')
    .select(
      'aoupp.code',
      'aoupp.caption AS caption',
      'cmctc.cmctckod AS contactCode',
      'aotlt.caption AS masterKey',
      'aoupp.status AS status',
      'resource.cmctcben AS resource',
      'cmrgr.caption AS resourceGroup',
      'aoupp.time AS createdAt',
      'aoupp.timeforf AS expiresAt',
      'aoupp.lastchged AS lastChanged',
      'aopri.code AS priority',
      'babuf.hyresid AS residenceId'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'aoupp.keycmobj')
    .innerJoin('aotlt', 'aotlt.keyaotlt', 'aoupp.keyaotlt')
    .leftJoin('cmctc', 'cmctc.keycmctc', 'aoupp.keycmctc')
    .leftJoin('cmctc as resource', 'resource.keycmctc', 'aoupp.keycmctc2')
    .leftJoin('cmrgr', 'cmrgr.keycmrgr', 'aoupp.keycmrgr')
    .leftJoin('aopri', 'aopri.keyaopri', 'aoupp.keyaopri')
    .where('babuf.bygcode', buildingId)
    .orderBy('aoupp.time', sortAscending ? 'asc' : 'desc')
    .offset(skip)
    .limit(limit)
    .then<XpandDbWorkOrder[]>(trimStrings)

  const transformedWorkOrders = workOrders.map(transformXpandDbWorkOrder)

  const parsed = XpandWorkOrderSchema.array().safeParse(transformedWorkOrders)
  if (!parsed.success) {
    logger.error(
      { error: parsed.error.format() },
      'Failed to parse work orders from Xpand DB'
    )

    return { ok: false, err: 'schema-error' }
  }

  return { ok: true, data: parsed.data }
}

export async function getWorkOrderDetails(
  workOrderCode: string
): Promise<
  AdapterResult<XpandWorkOrderDetails, 'not-found' | 'schema-error' | 'unknown'>
> {
  logger.info(`Getting details for work order code: ${workOrderCode}`)

  const workOrder = await db<XpandDbWorkOrderDetails>('aoupp')
    .select(
      'aoupp.code',
      'aoupp.caption AS caption',
      'cmctc.cmctckod AS contactCode',
      'aotlt.caption AS masterKey',
      'aoupp.status AS status',
      'resource.cmctcben AS resource',
      'cmrgr.caption AS resourceGroup',
      'aoupp.time AS createdAt',
      'aoupp.timeforf AS expiresAt',
      'aoupp.lastchged AS lastChanged',
      'aopri.code AS priority',
      'babuf.hyresid AS residenceId',
      db.raw(`
        JSON_QUERY(
          (
            SELECT
              aoupr.caption AS caption,
              aopla.caption AS locationCaption,
              aopla.code AS locationCode,
              aobdl.caption AS equipmentCaption,
              aobdl.code AS equipmentCode
            FROM aoupr
            LEFT JOIN aopla ON aoupr.keyaopla = aopla.keyaopla
            LEFT JOIN aobdl ON aoupr.keyaobdl = aobdl.keyaobdl
            WHERE aoupr.keyaoupp = aoupp.keyaoupp
            FOR JSON PATH
          )
        ) AS rows
      `)
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'aoupp.keycmobj')
    .innerJoin('aotlt', 'aotlt.keyaotlt', 'aoupp.keyaotlt')
    .leftJoin('cmctc', 'cmctc.keycmctc', 'aoupp.keycmctc')
    .leftJoin('cmctc as resource', 'cmctc.keycmctc', 'aoupp.keycmctc2')
    .leftJoin('cmrgr', 'cmrgr.keycmrgr', 'aoupp.keycmrgr')
    .leftJoin('aopri', 'aopri.keyaopri', 'aoupp.keyaopri')
    .where('aoupp.code', workOrderCode)
    .first()
    .then<XpandDbWorkOrderDetails>(trimStrings)

  if (!workOrder) {
    return { ok: false, err: 'not-found' }
  }

  const transformedWorkOrder = transformXpandDbWorkOrderDetails(workOrder)

  const parsed = XpandWorkOrderDetailsSchema.safeParse(transformedWorkOrder)
  if (!parsed.success) {
    logger.error(
      { error: parsed.error.format() },
      'Failed to parse work order from Xpand DB'
    )

    return { ok: false, err: 'schema-error' }
  }

  return { ok: true, data: parsed.data }
}
