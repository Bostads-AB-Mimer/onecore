import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import { inspection as inspectionTypes } from '@onecore/types'
import { db } from '../db'
import { AdapterResult } from '../../types'
import {
  AddRoomToInspectionParams,
  CreateInspectionParams,
  INSPECTION_STATUS,
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
    // Xpand-sourced remarks have no responsibility concept; the PDF generator
    // detects this and falls back to a single SUMMA row.
    costResponsibility: null,
    invoice: r.invoice,
    quantity: r.quantity,
    isMissing: r.isMissing,
    fixedDate: r.fixedDate,
    workOrderCreated: r.workOrderCreated,
    workOrderStatus: r.workOrderStatus,
  }
}

const DEFAULT_CHECKLIST: inspectionTypes.Checklist = {
  groundFaultBreaker: false,
  smokeDetector: false,
  electricalSchema: false,
  electricalSystem: false,
}

// Parses the JSON-encoded checklist column. Returns ChecklistSchema defaults
// for missing or malformed payloads so a corrupt row doesn't deny reads.
function parseChecklist(
  inspectionId: string | number,
  checklist: string | null | undefined
): inspectionTypes.Checklist {
  if (!checklist) return DEFAULT_CHECKLIST

  let raw: unknown
  try {
    raw = JSON.parse(checklist)
  } catch {
    logger.error(
      { inspectionId },
      'Failed to parse checklist JSON for inspection'
    )
    return DEFAULT_CHECKLIST
  }

  const parsed = inspectionTypes.ChecklistSchema.safeParse(raw)
  if (!parsed.success) {
    logger.error(
      { inspectionId, errors: parsed.error.errors },
      'checklist payload does not match ChecklistSchema'
    )
    return DEFAULT_CHECKLIST
  }

  return parsed.data
}

// Base mapper shared by DetailedXpandInspection and InternalInspection responses
// — both share every field except `rooms`, which differs by shape (xpand remarks
// vs. internal room/component data) and nullability.
function mapDbInspectionToResponse<R>(
  inspection: DbInspection,
  rooms: R
): Omit<inspectionTypes.DetailedXpandInspection, 'rooms'> & { rooms: R } {
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
    checklist: parseChecklist(inspection.id, inspection.checklist),
    rooms,
  }
}

// Parses the JSON-encoded draftRooms column with the InspectionRoom schema.
// Returns null for missing or malformed payloads so callers can still respond
// (failing here would deny status updates on inspections with corrupt drafts).
function parseDraftRooms(
  inspectionId: string,
  draftRooms: string | null | undefined
): inspectionTypes.InspectionRoom[] | null {
  if (!draftRooms) return null

  let raw: unknown
  try {
    raw = JSON.parse(draftRooms)
  } catch {
    logger.error(
      { inspectionId },
      'Failed to parse draftRooms JSON for inspection'
    )
    return null
  }

  const parsed = inspectionTypes.InspectionRoomSchema.array().safeParse(raw)
  if (!parsed.success) {
    logger.error(
      { inspectionId, errors: parsed.error.errors },
      'draftRooms payload does not match InspectionRoom schema'
    )
    return null
  }

  return parsed.data
}

export async function createInspection(
  dbConnection: Knex = db,
  params: CreateInspectionParams
): Promise<
  AdapterResult<
    inspectionTypes.DetailedXpandInspection,
    'validation-error' | 'unknown'
  >
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
    inspectionTypes.InternalInspection,
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

      const rooms = parseDraftRooms(inspectionId, updated.draftRooms)

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
    inspectionTypes.InternalInspection,
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
    statusFilter?: inspectionTypes.InspectionStatusFilter
    inspector?: string
    address?: string
  } = {}
): Promise<
  AdapterResult<
    { inspections: inspectionTypes.XpandInspection[]; totalRecords: number },
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

    if (statusFilter === inspectionTypes.INSPECTION_STATUS_FILTER.ONGOING) {
      baseQuery.whereNot('status', 'completed')
    } else if (
      statusFilter === inspectionTypes.INSPECTION_STATUS_FILTER.COMPLETED
    ) {
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

    const parsed =
      inspectionTypes.XpandInspectionSchema.array().safeParse(inspections)
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
  statusFilter?: inspectionTypes.InspectionStatusFilter
): Promise<
  AdapterResult<inspectionTypes.XpandInspection[], 'schema-error' | 'unknown'>
> {
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

    if (statusFilter === inspectionTypes.INSPECTION_STATUS_FILTER.ONGOING) {
      query.whereNot('status', 'completed')
    } else if (
      statusFilter === inspectionTypes.INSPECTION_STATUS_FILTER.COMPLETED
    ) {
      query.where('status', 'completed')
    }

    const dbInspections = await query.orderBy('date', 'desc')

    const inspections = dbInspections.map((row) => ({
      ...row,
      id: String(row.id),
    }))

    const parsed =
      inspectionTypes.XpandInspectionSchema.array().safeParse(inspections)
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

    // Build the update object — only include the optional MIM-1818 fields
    // when they were supplied. Pre-1818 clients send no value for these,
    // and we want to leave the previously persisted column alone in that
    // case rather than overwrite with `undefined`.
    const update: Record<string, unknown> = {
      inspector: params.inspectorName,
      draftRooms: JSON.stringify(params.rooms),
      isFurnished: params.isFurnished,
      status: INSPECTION_STATUS.STARTED,
      startedAt: new Date(),
    }
    if (params.isTenantPresent !== undefined) {
      update.isTenantPresent = params.isTenantPresent
    }
    if (params.isNewTenantPresent !== undefined) {
      update.isNewTenantPresent = params.isNewTenantPresent
    }
    if (params.checklist !== undefined) {
      update.checklist = JSON.stringify(params.checklist)
    }
    if (params.date !== undefined) {
      update.date = params.date
    }
    if (params.type !== undefined) {
      update.type = params.type
    }

    await dbConnection('inspection').where('id', inspectionId).update(update)

    return { ok: true, data: undefined }
  } catch (error) {
    logger.error(
      { error },
      `Error saving inspection draft for inspectionId: ${inspectionId}`
    )
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Drops the tracking row that marks a room as added during the inspection.
 * Returns 'not-found' if no row matched — the caller decides whether that's
 * an error (e.g. core's orchestration treats it as a 404).
 */
export async function removeAddedRoomFromInspection(
  dbConnection: Knex = db,
  params: { inspectionId: number; xpandRoomId: string }
): Promise<AdapterResult<void, 'not-found' | 'unknown'>> {
  try {
    const deleted = await dbConnection('inspection_added_room')
      .where({
        inspectionId: params.inspectionId,
        xpandRoomId: params.xpandRoomId,
      })
      .delete()

    if (deleted === 0) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: true, data: undefined }
  } catch (err) {
    logger.error(
      {
        err,
        inspectionId: params.inspectionId,
        xpandRoomId: params.xpandRoomId,
      },
      'db-adapter.removeAddedRoomFromInspection'
    )
    return { ok: false, err: 'unknown' }
  }
}

// Empty InspectionRoom skeleton stamped into draftRooms when a room is first
// added. Mirrors the FE's initialRoomData so the row is interaction-ready
// (and refresh-safe) before the inspector saves a draft.
function emptyInspectionRoom(roomId: string): inspectionTypes.InspectionRoom {
  return {
    roomId,
    conditions: { details: '' },
    actions: { details: [] },
    componentNotes: { details: '' },
    componentCosts: { details: 0 },
    componentPhotos: { details: [] },
    componentCostResponsibilities: { details: null },
    photos: [],
    isApproved: false,
    isHandled: false,
    detailComponents: [],
    components: [],
    isAddedInThisInspection: false,
  }
}

/**
 * Records that the inspector added a room (already created in Xpand by the
 * property service) during the current inspection. Two atomic effects:
 *   1. Inserts the tracking row into inspection_added_room (UNIQUE on
 *      inspectionId+xpandRoomId so retries are harmless).
 *   2. Appends an empty InspectionRoom entry to the inspection's draftRooms
 *      JSON so the room is refresh-safe before the FE saves a draft.
 *      Idempotent: skips the append if the room is already in draftRooms.
 *
 * On save, the FE overwrites draftRooms with its full inspectionData, so the
 * placeholder is replaced by whatever the user has edited — same roomId, no
 * duplicate.
 */
export async function addRoomToInspection(
  dbConnection: Knex = db,
  params: AddRoomToInspectionParams
): Promise<
  AdapterResult<
    { inspectionId: number; xpandRoomId: string },
    'inspection-not-found' | 'unknown'
  >
> {
  try {
    await dbConnection.transaction(async (trx) => {
      const inspection = await trx('inspection')
        .where('id', params.inspectionId)
        .first('id', 'draftRooms')
      if (!inspection) {
        throw new Error('inspection-not-found')
      }

      try {
        await trx('inspection_added_room').insert({
          inspectionId: params.inspectionId,
          xpandRoomId: params.xpandRoomId,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!/uq_inspection_added_room|UNIQUE/i.test(msg)) {
          throw err
        }
      }

      const existing =
        parseDraftRooms(String(params.inspectionId), inspection.draftRooms) ??
        []
      if (!existing.some((r) => r.roomId === params.xpandRoomId)) {
        const next = [...existing, emptyInspectionRoom(params.xpandRoomId)]
        await trx('inspection')
          .where('id', params.inspectionId)
          .update({ draftRooms: JSON.stringify(next) })
      }
    })

    return {
      ok: true,
      data: {
        inspectionId: params.inspectionId,
        xpandRoomId: params.xpandRoomId,
      },
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'inspection-not-found') {
      return { ok: false, err: 'inspection-not-found' }
    }
    logger.error(
      {
        err,
        inspectionId: params.inspectionId,
        xpandRoomId: params.xpandRoomId,
      },
      'db-adapter.addRoomToInspection'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getInspectionById(
  dbConnection: Knex = db,
  inspectionId: string
): Promise<
  AdapterResult<inspectionTypes.InternalInspection, 'not-found' | 'unknown'>
> {
  try {
    const [inspection] = await dbConnection
      .select(
        'id',
        'status',
        'date',
        'startedAt',
        'endedAt',
        'inspector',
        'type',
        'residenceId',
        'address',
        'apartmentCode',
        'isFurnished',
        'leaseId',
        'isTenantPresent',
        'isNewTenantPresent',
        'masterKeyAccess',
        'hasRemarks',
        'notes',
        'totalCost',
        'remarkCount',
        'draftRooms',
        'checklist'
      )
      .from<DbInspection>('inspection')
      .where('id', inspectionId)

    if (!inspection) {
      return { ok: false, err: 'not-found' }
    }

    let rooms = parseDraftRooms(inspectionId, inspection.draftRooms)

    // Decorate rooms with isAddedInThisInspection by joining the tracking table.
    if (rooms && rooms.length > 0) {
      const addedRows = await dbConnection('inspection_added_room')
        .select('xpandRoomId')
        .where('inspectionId', inspection.id)
      const addedSet = new Set<string>(
        addedRows.map((r: { xpandRoomId: string }) => r.xpandRoomId)
      )
      rooms = rooms.map((room) => ({
        ...room,
        isAddedInThisInspection: addedSet.has(room.roomId),
      }))
    }

    return {
      ok: true,
      data: mapDbInspectionToResponse(inspection, rooms),
    }
  } catch (error) {
    logger.error({ error }, `Error fetching inspection by ID: ${inspectionId}`)
    return { ok: false, err: 'unknown' }
  }
}
