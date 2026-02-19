import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import { db } from '../db'
import { AdapterResult } from '../../types'
import {
  DetailedXpandInspection,
  XpandInspection,
  XpandInspectionSchema,
  InspectionStatusFilter,
  INSPECTION_STATUS_FILTER,
} from '../../schemas'
import { CreateInspectionParams } from './schemas'
import { DbInspection, DbInspectionRoom, DbInspectionRemark } from './types'

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

          remarks.push({
            remarkId: remark.remarkId,
            location: remark.location,
            buildingComponent: remark.buildingComponent,
            notes: remark.notes,
            remarkGrade: remark.remarkGrade,
            remarkStatus: remark.remarkStatus,
            cost: remark.cost,
            invoice: remark.invoice,
            quantity: remark.quantity,
            isMissing: remark.isMissing,
            fixedDate: remark.fixedDate,
            workOrderCreated: remark.workOrderCreated,
            workOrderStatus: remark.workOrderStatus,
          })
        }

        rooms.push({
          room: room.roomName,
          remarks,
        })
      }

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

export async function getInspections(
  dbConnection: Knex = db,
  {
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
