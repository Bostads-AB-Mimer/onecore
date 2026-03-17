import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import { db } from '../db'
import { AdapterResult } from '../../types'
import {
  DetailedXpandInspection,
  InternalInspection,
  XpandInspection,
  XpandInspectionSchema,
  InspectionStatusFilter,
  INSPECTION_STATUS_FILTER,
} from '../../schemas'
import {
  CreateInspectionParams,
  INSPECTION_STATUS,
  InspectionRoom,
  InspectionStatus,
  SaveInspectionDraftParams,
  UpdateInternalInspectionParams,
  validateStatusTransition,
} from './schemas'
import { DbInspection, DbInspectionRoom, DbInspectionRemark } from './types'

function mapDbRemarkToResponse(r: DbInspectionRemark) {
  return {
    remarkId: r.remarkId,
    location: r.location,
    buildingComponent: r.buildingComponent,
    notes: r.notes,
    remarkGrade: r.remarkGrade,
    remarkStatus: r.remarkStatus,
    cost: r.cost,
    invoice: r.invoice,
    quantity: r.quantity,
    isMissing: r.isMissing,
    fixedDate: r.fixedDate,
    workOrderCreated: r.workOrderCreated,
    workOrderStatus: r.workOrderStatus,
  }
}

function mapDbInspectionToResponse(
  inspection: DbInspection,
  rooms: DetailedXpandInspection['rooms']
): DetailedXpandInspection {
  return {
    id: String(inspection.id),
    status: inspection.status,
    date: inspection.date,
    startedAt: inspection.startedAt,
    endedAt: inspection.endedAt,
    inspector: inspection.inspector,
    type: inspection.type,
    residenceId: inspection.residenceId,
    address: inspection.address,
    apartmentCode: inspection.apartmentCode,
    isFurnished: inspection.isFurnished,
    leaseId: inspection.leaseId,
    isTenantPresent: inspection.isTenantPresent,
    isNewTenantPresent: inspection.isNewTenantPresent,
    masterKeyAccess: inspection.masterKeyAccess,
    hasRemarks: inspection.hasRemarks,
    notes: inspection.notes,
    totalCost: inspection.totalCost,
    remarkCount: inspection.remarkCount,
    rooms,
  }
}

export async function createInspection(
  dbConnection: Knex = db,
  params: CreateInspectionParams
): Promise<
  AdapterResult<DetailedXpandInspection, 'validation-error' | 'unknown'>
> {
  try {
    const result = await dbConnection.transaction(async (trx) => {
      // Calculate remarkCount
      const remarkCount = params.rooms.reduce(
        (sum, room) => sum + room.remarks.length,
        0
      )

      // Insert inspection
      const [inspection] = await trx
        .insert({
          status: params.status,
          date: params.date,
          startedAt: params.startedAt,
          endedAt: params.endedAt,
          inspector: params.inspector,
          type: params.type,
          residenceId: params.residenceId,
          address: params.address,
          apartmentCode: params.apartmentCode,
          isFurnished: params.isFurnished,
          leaseId: params.leaseId,
          isTenantPresent: params.isTenantPresent,
          isNewTenantPresent: params.isNewTenantPresent,
          masterKeyAccess: params.masterKeyAccess,
          hasRemarks: params.hasRemarks,
          notes: params.notes,
          totalCost: params.totalCost,
          remarkCount,
        })
        .into('inspection')
        .returning<DbInspection[]>('*')

      // Insert rooms and remarks
      const rooms = []
      for (const roomData of params.rooms) {
        const [room] = await trx
          .insert({
            inspectionId: inspection.id,
            roomName: roomData.room,
          })
          .into('inspection_room')
          .returning<DbInspectionRoom[]>('*')

        const remarks = []
        for (const remarkData of roomData.remarks) {
          const [remark] = await trx
            .insert({
              roomId: room.id,
              remarkId: remarkData.remarkId,
              location: remarkData.location,
              buildingComponent: remarkData.buildingComponent,
              notes: remarkData.notes,
              remarkGrade: remarkData.remarkGrade,
              remarkStatus: remarkData.remarkStatus,
              cost: remarkData.cost,
              invoice: remarkData.invoice,
              quantity: remarkData.quantity,
              isMissing: remarkData.isMissing,
              fixedDate: remarkData.fixedDate,
              workOrderCreated: remarkData.workOrderCreated,
              workOrderStatus: remarkData.workOrderStatus,
            })
            .into('inspection_remark')
            .returning<DbInspectionRemark[]>('*')

          remarks.push(mapDbRemarkToResponse(remark))
        }

        rooms.push({
          room: room.roomName,
          remarks,
        })
      }

      return mapDbInspectionToResponse(inspection, rooms)
    })

    return {
      ok: true,
      data: result,
    }
  } catch (error) {
    logger.error(error, 'Error creating inspection in local database')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateInternalInspection(
  dbConnection: Knex = db,
  inspectionId: string,
  params: UpdateInternalInspectionParams
): Promise<
  AdapterResult<
    DetailedXpandInspection,
    'not-found' | 'invalid-status-transition' | 'unknown'
  >
> {
  try {
    const result = await dbConnection.transaction(async (trx) => {
      const [inspection] = await trx
        .select('*')
        .from<DbInspection>('inspection')
        .where('id', inspectionId)

      if (!inspection) {
        return { ok: false as const, err: 'not-found' as const }
      }

      if (params.status) {
        const transition = validateStatusTransition(
          inspection.status,
          params.status
        )
        if (!transition.ok) {
          return {
            ok: false as const,
            err: 'invalid-status-transition' as const,
          }
        }
      }

      const updatePayload: Partial<DbInspection> = {}
      if (params.status) updatePayload.status = params.status
      if (params.inspector) updatePayload.inspector = params.inspector
      if (params.status === INSPECTION_STATUS.STARTED)
        updatePayload.startedAt = new Date()
      if (params.status === INSPECTION_STATUS.COMPLETED)
        updatePayload.endedAt = new Date()

      const [updated] = await trx
        .update(updatePayload)
        .from<DbInspection>('inspection')
        .where('id', inspectionId)
        .returning<DbInspection[]>('*')

      const dbRooms = await trx
        .select('*')
        .from<DbInspectionRoom>('inspection_room')
        .where('inspectionId', updated.id)

      const rooms = []
      for (const dbRoom of dbRooms) {
        const dbRemarks = await trx
          .select('*')
          .from<DbInspectionRemark>('inspection_remark')
          .where('roomId', dbRoom.id)

        rooms.push({
          room: dbRoom.roomName,
          remarks: dbRemarks.map(mapDbRemarkToResponse),
        })
      }

      return {
        ok: true as const,
        data: mapDbInspectionToResponse(updated, rooms),
      }
    })

    return result
  } catch (error) {
    logger.error(error, 'Error updating internal inspection in local database')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateInspectionStatus(
  dbConnection: Knex = db,
  inspectionId: string,
  newStatus: InspectionStatus
): Promise<
  AdapterResult<
    DetailedXpandInspection,
    'not-found' | 'invalid-status-transition' | 'unknown'
  >
> {
  return updateInternalInspection(dbConnection, inspectionId, {
    status: newStatus,
  })
}

export async function getInspections(
  dbConnection: Knex = db,
  {
    page = 1,
    limit = 25,
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
  } = {}
): Promise<
  AdapterResult<
    { inspections: XpandInspection[]; totalRecords: number },
    'schema-error' | 'unknown'
  >
> {
  logger.info('Getting inspections from local database')

  try {
    const baseQuery = dbConnection<DbInspection>('inspection').select(
      'id',
      'status',
      'date',
      'inspector',
      'type',
      'address',
      'apartmentCode',
      'leaseId',
      'masterKeyAccess'
    )

    if (statusFilter === INSPECTION_STATUS_FILTER.ONGOING) {
      baseQuery.whereNot('status', 'completed')
    } else if (statusFilter === INSPECTION_STATUS_FILTER.COMPLETED) {
      baseQuery.where('status', 'completed')
    }

    if (inspector) {
      baseQuery.where('inspector', inspector)
    }
    if (address) {
      baseQuery.where('address', address)
    }

    const countResult = (await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count('* as count')
      .first()) as { count: number } | undefined
    const totalRecords = Number(countResult?.count ?? 0)

    const offset = (page - 1) * limit
    const dbInspections = await baseQuery
      .orderBy('date', sortAscending ? 'asc' : 'desc')
      .offset(offset)
      .limit(limit)

    const inspections = dbInspections.map((row) => ({
      ...row,
      id: String(row.id),
    }))

    const parsed = XpandInspectionSchema.array().safeParse(inspections)
    if (!parsed.success) {
      logger.error(
        { error: parsed.error.format() },
        'Failed to parse inspections from local database'
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
      'Database error while fetching inspections from local database'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getInspectionsByResidenceId(
  dbConnection: Knex = db,
  residenceId: string,
  statusFilter?: InspectionStatusFilter
): Promise<AdapterResult<XpandInspection[], 'schema-error' | 'unknown'>> {
  logger.info(
    `Getting inspections from local database for residenceId: ${residenceId}`
  )

  try {
    const query = dbConnection<DbInspection>('inspection')
      .select(
        'id',
        'status',
        'date',
        'inspector',
        'type',
        'address',
        'apartmentCode',
        'leaseId',
        'masterKeyAccess'
      )
      .where('residenceId', residenceId)

    if (statusFilter === INSPECTION_STATUS_FILTER.ONGOING) {
      query.whereNot('status', 'completed')
    } else if (statusFilter === INSPECTION_STATUS_FILTER.COMPLETED) {
      query.where('status', 'completed')
    }

    const dbInspections = await query.orderBy('date', 'desc')

    const inspections = dbInspections.map((row) => ({
      ...row,
      id: String(row.id),
    }))

    const parsed = XpandInspectionSchema.array().safeParse(inspections)
    if (!parsed.success) {
      logger.error(
        { error: parsed.error.format() },
        'Failed to parse inspections from local database'
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
      `Database error while fetching inspections from local database for residenceId: ${residenceId}`
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function saveInspectionDraft(
  dbConnection: Knex = db,
  inspectionId: string,
  params: SaveInspectionDraftParams
): Promise<AdapterResult<void, 'not-found' | 'unknown'>> {
  try {
    const [inspection] = await dbConnection
      .select('id')
      .from<DbInspection>('inspection')
      .where('id', inspectionId)

    if (!inspection) {
      return { ok: false, err: 'not-found' }
    }

    await dbConnection('inspection')
      .where('id', inspectionId)
      .update({
        inspector: params.inspectorName,
        draftRooms: JSON.stringify(params.rooms),
        status: INSPECTION_STATUS.STARTED,
        startedAt: new Date(),
      })

    return { ok: true, data: undefined }
  } catch (error) {
    logger.error(
      { error },
      `Error saving inspection draft for inspectionId: ${inspectionId}`
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getInspectionById(
  dbConnection: Knex = db,
  inspectionId: string
): Promise<AdapterResult<InternalInspection, 'not-found' | 'unknown'>> {
  try {
    const [inspection] = await dbConnection
      .select(
        'id',
        'status',
        'date',
        'inspector',
        'type',
        'address',
        'apartmentCode',
        'leaseId',
        'masterKeyAccess',
        'residenceId',
        'draftRooms'
      )
      .from<DbInspection>('inspection')
      .where('id', inspectionId)

    if (!inspection) {
      return { ok: false, err: 'not-found' }
    }

    let rooms: InspectionRoom[] | null = null
    if (inspection.draftRooms) {
      try {
        rooms = JSON.parse(inspection.draftRooms) as InspectionRoom[]
      } catch {
        logger.error(
          { inspectionId },
          'Failed to parse draftRooms JSON for inspection'
        )
      }
    }

    return {
      ok: true,
      data: {
        id: String(inspection.id),
        status: inspection.status,
        date: inspection.date,
        inspector: inspection.inspector,
        type: inspection.type,
        address: inspection.address,
        apartmentCode: inspection.apartmentCode,
        leaseId: inspection.leaseId,
        masterKeyAccess: inspection.masterKeyAccess,
        residenceId: inspection.residenceId,
        rooms,
      },
    }
  } catch (error) {
    logger.error({ error }, `Error fetching inspection by ID: ${inspectionId}`)
    return { ok: false, err: 'unknown' }
  }
}
