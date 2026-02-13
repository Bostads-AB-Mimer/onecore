import knex from 'knex'
import { logger } from '@onecore/utilities'
import Config from '../../../../common/config'
import { AdapterResult } from '../../types'
import {
  XpandInspection,
  XpandInspectionSchema,
  DetailedXpandInspection,
  DetailedXpandInspectionSchema,
  INSPECTION_STATUS_FILTER,
  InspectionStatusFilter,
} from '../../schemas'
import {
  trimStrings,
  mapInspectionStatus,
  convertNumericBooleans,
} from './utils'

export interface XpandDbInspection {
  id: string
  status: number
  date: Date
  inspector: string
  type: string
  address: string
  apartmentCode: string
  leaseId: string
}

export interface XpandDbDetailedInspection {
  id: string
  status: number
  date: Date
  startedAt: Date | null
  endedAt: Date | null
  inspector: string
  type: string
  residenceId: string
  address: string
  apartmentCode: string
  isFurnished: number | null
  leaseId: string
  isTenantPresent: number | null
  isNewTenantPresent: number | null
  masterKeyAccess: string | null
  hasRemarks: boolean
  notes: string | null
  totalCost: number
}

export interface XpandDbDetailedInspectionRemark {
  remarkId: string
  location: string | null
  buildingComponent: string | null
  notes: string | null
  remarkGrade: number
  remarkStatus: string | null
  cost: number
  invoice: number
  quantity: number
  isMissing: number
  fixedDate: Date | null
  workOrderCreated: number
  workOrderStatus: number | null
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

function buildBaseInspectionQuery() {
  return db<XpandDbInspection>('lbbes')
    .select(
      'lbbes.caption AS id',
      'lbbes.status AS status',
      'lbbes.besdat AS date',
      'cmctc.cmctcben AS inspector',
      'lbbka.caption AS type',
      'babuf.caption AS address',
      'babuf.lghcode AS apartmentCode',
      'hyobj.hyobjben AS leaseId',
      'aotlt.caption AS masterKeyAccess'
    )
    .innerJoin('babuf', 'lbbes.keycmobj', 'babuf.keycmobj')
    .innerJoin('cmctc', 'lbbes.keycmctc', 'cmctc.keycmctc')
    .innerJoin('hyobj', 'lbbes.keyhyobj', 'hyobj.keyhyobj')
    .innerJoin('lbbka', 'lbbes.KEYLBBKA', 'lbbka.KEYLBBKA')
    .leftJoin('aotlt', 'lbbes.KEYAOTLT', 'aotlt.KEYAOTLT')
    .whereNot('lbbes.status', 6)
}

export async function getInspections({
  page = 1,
  limit = 100,
  sortAscending,
  statusFilter,
  inspector,
  address,
}: {
  page?: number
  limit?: number
  sortAscending?: boolean
  statusFilter?: InspectionStatusFilter
  inspector?: string
  address?: string
} = {}): Promise<
  AdapterResult<
    { inspections: XpandInspection[]; totalRecords: number },
    'schema-error' | 'unknown'
  >
> {
  logger.info(`Getting inspections from Xpand`)

  try {
    const baseQuery = buildBaseInspectionQuery()

    if (statusFilter === INSPECTION_STATUS_FILTER.ONGOING) {
      baseQuery.whereNot('lbbes.status', 1)
    } else if (statusFilter === INSPECTION_STATUS_FILTER.COMPLETED) {
      baseQuery.where('lbbes.status', 1)
    }

    if (inspector) {
      baseQuery.where('cmctc.cmctcben', inspector)
    }
    if (address) {
      baseQuery.where('babuf.caption', address)
    }

    const countResult = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count('* as count')
      .first()
    const totalRecords = Number(countResult?.count ?? 0)

    const offset = (page - 1) * limit
    const dbInspections = await baseQuery
      .orderBy('lbbes.besdat', sortAscending ? 'asc' : 'desc')
      .offset(offset)
      .limit(limit)

    const trimmedInspections = trimStrings(dbInspections)
    const inspections = mapInspectionStatus(trimmedInspections)

    const parsed = XpandInspectionSchema.array().safeParse(inspections)
    if (!parsed.success) {
      logger.error(
        { error: parsed.error.format() },
        'Failed to parse inspections from Xpand DB'
      )
      return { ok: false, err: 'schema-error' }
    }

    return {
      ok: true,
      data: { inspections: parsed.data, totalRecords },
    }
  } catch (error) {
    logger.error(
      { error },
      'Database error while fetching inspections from Xpand'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getInspectionsByResidenceId(
  residenceId: string,
  statusFilter?: InspectionStatusFilter
): Promise<AdapterResult<XpandInspection[], 'schema-error' | 'unknown'>> {
  logger.info(`Getting inspections from Xpand for residenceId: ${residenceId}`)

  try {
    const query = buildBaseInspectionQuery().andWhere(
      'babuf.hyresid',
      residenceId
    )

    if (statusFilter === INSPECTION_STATUS_FILTER.ONGOING) {
      query.whereNot('lbbes.status', 1)
    } else if (statusFilter === INSPECTION_STATUS_FILTER.COMPLETED) {
      query.where('lbbes.status', 1)
    }

    const dbInspections = await query.orderBy('lbbes.besdat', 'desc')

    const trimmedInspections = trimStrings(dbInspections)
    const inspections = mapInspectionStatus(trimmedInspections)

    const parsed = XpandInspectionSchema.array().safeParse(inspections)
    if (!parsed.success) {
      logger.error(
        { error: parsed.error.format() },
        'Failed to parse inspections from Xpand DB'
      )
      return { ok: false, err: 'schema-error' }
    }

    return {
      ok: true,
      data: parsed.data,
    }
  } catch (error) {
    logger.error(
      { error },
      `Database error while fetching inspections from Xpand for residenceId: ${residenceId}`
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getInspectionById(
  inspectionId: string
): Promise<
  AdapterResult<
    DetailedXpandInspection,
    'not-found' | 'schema-error' | 'unknown'
  >
> {
  logger.info(`Getting inspection from Xpand for inspectionId: ${inspectionId}`)

  try {
    const dbInspection = await db<XpandDbDetailedInspection>('lbbes')
      .select(
        'lbbes.caption AS id',
        'lbbes.status AS status',
        'lbbes.besdat AS date',
        'lbbes.bestime AS startedAt',
        'lbbes.endtime AS endedAt',
        'cmctc.cmctcben AS inspector',
        'lbbka.caption AS type',
        'babuf.hyresid AS residenceId',
        'babuf.caption AS address',
        'babuf.lghcode AS apartmentCode',
        'lbbes.moblerad AS isFurnished',
        'hyobj.hyobjben AS leaseId',
        'lbbes.hgnarvar AS isTenantPresent',
        'lbbes.nyhgnarvar AS isNewTenantPresent',
        'aotlt.caption AS masterKeyAccess',
        'lbbes.anmexists AS hasRemarks',
        'lbbes.text AS notes',
        'lbbes.amount AS totalCost'
      )
      .innerJoin('babuf', 'lbbes.keycmobj', 'babuf.keycmobj')
      .innerJoin('cmctc', 'lbbes.keycmctc', 'cmctc.keycmctc')
      .innerJoin('hyobj', 'lbbes.keyhyobj', 'hyobj.keyhyobj')
      .innerJoin('lbbka', 'lbbes.KEYLBBKA', 'lbbka.KEYLBBKA')
      .leftJoin('aotlt', 'lbbes.KEYAOTLT', 'aotlt.KEYAOTLT')
      .whereNot('lbbes.status', 6)
      .andWhere('lbbes.caption', inspectionId)
      .first()

    if (!dbInspection) {
      return {
        ok: false,
        err: 'not-found',
      }
    }

    const trimmedInspection = trimStrings(dbInspection)
    const rawInspection = convertNumericBooleans(trimmedInspection, [
      'hasRemarks',
      'isTenantPresent',
      'isNewTenantPresent',
      'isFurnished',
    ])

    const remarks = await getInspectionRemarks(inspectionId)
    if (!remarks.ok) {
      return { ok: false, err: remarks.err }
    }

    const roomsMap = new Map<string, XpandDbDetailedInspectionRemark[]>()
    for (const remark of remarks.data) {
      const room = remark.location || 'Övrigt'
      const roomRemarks = roomsMap.get(room)
      if (roomRemarks) {
        roomRemarks.push(remark)
      } else {
        roomsMap.set(room, [remark])
      }
    }

    const rooms = Array.from(roomsMap.entries()).map(([room, remarks]) => ({
      room,
      remarks,
    }))

    const inspectionWithStatus = mapInspectionStatus([rawInspection])[0]

    const inspectionWithRemarks = {
      ...inspectionWithStatus,
      remarkCount: remarks.data.length,
      rooms,
    }

    const parsed = DetailedXpandInspectionSchema.safeParse(
      inspectionWithRemarks
    )
    if (!parsed.success) {
      logger.error(
        { error: parsed.error.format() },
        'Failed to parse detailed inspection from Xpand DB'
      )
      return { ok: false, err: 'schema-error' }
    }

    return {
      ok: true,
      data: parsed.data,
    }
  } catch (error) {
    logger.error(
      { error },
      `Database error while fetching inspection from Xpand for inspectionId: ${inspectionId}`
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getInspectionRemarks(
  inspectionId: string
): Promise<AdapterResult<XpandDbDetailedInspectionRemark[], 'unknown'>> {
  logger.info(
    `Getting inspection remarks from Xpand for inspectionId: ${inspectionId}`
  )

  try {
    const dbRemarks = await db<XpandDbDetailedInspectionRemark>('lbanm')
      .select(
        'lbanm.keylbanm AS remarkId',
        'aopla.caption AS location',
        'aobdl.caption AS buildingComponent',
        'lbanm.notering AS notes',
        'lbanm.status AS remarkGrade',
        'lbrsd.caption AS remarkStatus',
        'lbanm.kostnad AS cost',
        'lbrsd.invoice AS invoice',
        'lbanm.quantity AS quantity',
        'lbanm.missing AS isMissing',
        'lbanm.atgdatum AS fixedDate',
        'lbrsd.aocreate AS workOrderCreated',
        'lbrsd.aostatus AS workOrderStatus'
      )
      .innerJoin('lbbes', 'lbanm.keylbbes', 'lbbes.keylbbes')
      .leftJoin('aopla', 'lbanm.keyaopla', 'aopla.keyaopla')
      .leftJoin('aobdl', 'lbanm.keyaobdl', 'aobdl.keyaobdl')
      .leftJoin('lbrsd', 'lbanm.keylbrsd', 'lbrsd.keylbrsd')
      .where('lbbes.caption', inspectionId)
      .orderBy(['aopla.caption', 'aobdl.caption'])

    if (!dbRemarks) {
      return {
        ok: true,
        data: [],
      }
    }

    const trimmedRemarks = trimStrings(dbRemarks)
    const rawInspectionRemarks = trimmedRemarks.map((remark) =>
      convertNumericBooleans(remark, [
        'invoice',
        'isMissing',
        'workOrderCreated',
      ])
    )

    return {
      ok: true,
      data: rawInspectionRemarks,
    }
  } catch (error) {
    logger.error(
      { error },
      `Database error while fetching inspection remarks from Xpand for inspectionId: ${inspectionId}`
    )
    return { ok: false, err: 'unknown' }
  }
}
