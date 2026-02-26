import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import { db } from '../db'
import { AdapterResult } from '../../types'
import { DetailedXpandInspection } from '../../schemas'
import { CreateInspectionParams, validateStatusTransition } from './schemas'
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

export async function updateInspectionStatus(
  dbConnection: Knex = db,
  inspectionId: string,
  newStatus: string
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

      const transition = validateStatusTransition(inspection.status, newStatus)
      if (!transition.ok) {
        return {
          ok: false as const,
          err: 'invalid-status-transition' as const,
        }
      }

      const [updated] = await trx
        .update({ status: newStatus })
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
          remarks: dbRemarks.map((r) => ({
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
          })),
        })
      }

      return {
        ok: true as const,
        data: {
          id: String(updated.id),
          status: updated.status,
          date: updated.date,
          startedAt: updated.startedAt,
          endedAt: updated.endedAt,
          inspector: updated.inspector,
          type: updated.type,
          residenceId: updated.residenceId,
          address: updated.address,
          apartmentCode: updated.apartmentCode,
          isFurnished: updated.isFurnished,
          leaseId: updated.leaseId,
          isTenantPresent: updated.isTenantPresent,
          isNewTenantPresent: updated.isNewTenantPresent,
          masterKeyAccess: updated.masterKeyAccess,
          hasRemarks: updated.hasRemarks,
          notes: updated.notes,
          totalCost: updated.totalCost,
          remarkCount: updated.remarkCount,
          rooms,
        },
      }
    })

    return result
  } catch (error) {
    logger.error(error, 'Error updating inspection status in local database')
    return { ok: false, err: 'unknown' }
  }
}
