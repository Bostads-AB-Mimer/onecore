import { Prisma } from '@prisma/client'
import { map } from 'lodash'

import { logger } from '@onecore/utilities'

import { CreateRoomRequest, Room } from '@src/types/room'
import { trimStrings } from '@src/utils/data-conversion'
import { generateXpandId } from '@src/utils/generate-xpand-id'
import { alwaysNumberFor, getDefaultCaption } from '@onecore/types'

import { prisma } from './db'

export class ResidenceNotFoundError extends Error {
  constructor(rentalId: string) {
    super(`Residence not found for rentalId: ${rentalId}`)
    this.name = 'ResidenceNotFoundError'
  }
}

const roomSelect = {
  id: true,
  propertyObjectId: true,
  code: true,
  name: true,
  sharedUse: true,
  sortingOrder: true,
  allowPeriodicWorks: true,
  spaceType: true,
  hasToilet: true,
  isHeated: true,
  hasThermostatValve: true,
  orientation: true,
  installationDate: true,
  deleteMark: true,
  fromDate: true,
  toDate: true,
  availableFrom: true,
  availableTo: true,
  timestamp: true,
  roomType: true,
} satisfies Prisma.RoomSelect

type RoomRecord = Prisma.RoomGetPayload<{ select: typeof roomSelect }>

function mapToRoom(v: RoomRecord): Room {
  return {
    ...v,
    deleted: Boolean(v.deleteMark),
    dates: {
      availableFrom: v.availableFrom,
      availableTo: v.availableTo,
      from: v.fromDate,
      to: v.toDate,
      installation: v.installationDate,
    },
    features: {
      hasThermostatValve: Boolean(v.hasThermostatValve),
      hasToilet: Boolean(v.hasToilet),
      isHeated: Boolean(v.isHeated),
      orientation: v.orientation,
    },
    usage: {
      allowPeriodicWorks: Boolean(v.allowPeriodicWorks),
      shared: Boolean(v.sharedUse),
      spaceType: v.spaceType,
    },
  }
}

export const getRoomById = async (id: string) => {
  return prisma.room
    .findUnique({
      where: {
        id: id,
      },
      select: roomSelect,
    })
    .then(trimStrings)
}

async function getRoomsByPropertyObjectIds(
  propertyObjectIds: string[]
): Promise<Room[]> {
  const rooms = await prisma.room
    .findMany({
      where: {
        propertyObjectId: {
          in: propertyObjectIds,
        },
      },
      select: roomSelect,
    })
    .then(trimStrings)

  return rooms.map(mapToRoom)
}

export async function getRooms(rentalId: string, roomCode?: string) {
  try {
    const propertyStructure = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balgh' },
        NOT: { rentalId: { endsWith: 'X' } },
      },
      select: {
        residenceId: true,
      },
    })

    if (!propertyStructure || !propertyStructure.residenceId) {
      throw new Error(`Residence not found for rentalId: ${rentalId}`)
    }

    const propertyStructures = await prisma.propertyStructure.findMany({
      where: {
        residenceId: propertyStructure.residenceId,
        NOT: {
          staircaseId: null,
          residenceId: null,
          roomId: null,
        },
        localeId: null,
        ...(roomCode ? { roomCode } : {}),
      },
    })

    return getRoomsByPropertyObjectIds(
      map(propertyStructures, 'propertyObjectId')
    )
  } catch (err) {
    logger.error({ err }, 'room-adapter.getRooms')
    throw err
  }
}

export async function getRoomsByFacilityId(facilityId: string) {
  const facility = await prisma.facility
    .findFirst({
      where: {
        id: facilityId,
      },
    })
    .then(trimStrings)

  if (!facility) {
    return []
  }

  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      localeId: facility.propertyObjectId,
      NOT: {
        roomId: null,
      },
    },
  })

  return getRoomsByPropertyObjectIds(
    map(propertyStructures, 'propertyObjectId')
  )
}

/**
 * Computes the next available zero-padded 2-digit room code for a residence.
 * Existing codes (e.g. '01', '02', '03') are scanned via babuf.rumcode; non-
 * numeric codes are ignored (TRY_CAST → NULL).
 */
export const getNextRoomCode = async (rentalId: string): Promise<string> => {
  const rows = await prisma.$queryRaw<{ next_n: number }[]>`
    SELECT ISNULL(MAX(TRY_CAST(bf.rumcode AS INT)), 0) + 1 AS next_n
    FROM babuf bf
    INNER JOIN barum r ON r.keycmobj = bf.keycmobj
    WHERE bf.hyresid = ${rentalId}
      AND bf.keyobjlok IS NULL
      AND bf.deletemark = 0
  `
  const next = rows[0]?.next_n ?? 1
  return String(next).padStart(2, '0')
}

/**
 * Resolves the final caption for a new room.
 *  - If captionOverride is provided, returns it verbatim (caller is expected to
 *    have validated it against the curated list at the schema layer).
 *  - Otherwise: takes the default caption for the type from the curated list,
 *    and auto-numbers based on existing rooms in the residence:
 *      alwaysNumber=true  → "RUM 1", "RUM 2", ...
 *      alwaysNumber=false → "HALL", "HALL 2", ...
 */
export const resolveRoomCaption = async (
  rentalId: string,
  typeCode: string,
  captionOverride?: string
): Promise<string> => {
  if (captionOverride !== undefined) return captionOverride

  const base = getDefaultCaption(typeCode)
  if (base === null) {
    throw new Error(`No default caption for unknown roomTypeCode "${typeCode}"`)
  }

  const likePattern = base + ' [0-9]%'
  const substringStart = base.length + 2
  const rows = await prisma.$queryRaw<{ max_n: number | null }[]>`
    SELECT MAX(
      CASE
        WHEN r.caption = ${base} THEN 1
        WHEN r.caption LIKE ${likePattern}
             THEN TRY_CAST(SUBSTRING(r.caption, ${substringStart}, 10) AS INT)
        ELSE NULL
      END
    ) AS max_n
    FROM babuf bf
    INNER JOIN barum r ON r.keycmobj = bf.keycmobj
    WHERE bf.hyresid = ${rentalId}
      AND bf.keyobjlok IS NULL
      AND bf.deletemark = 0
      AND r.deletemark = 0
  `
  const maxN = rows[0]?.max_n ?? null
  const alwaysNumber = alwaysNumberFor(typeCode)

  if (maxN === null) return alwaysNumber ? `${base} 1` : base
  return `${base} ${maxN + 1}`
}

/**
 * Creates a room in Xpand. Performs three inserts in a single transaction:
 *   1. cmobj  — the new PropertyObject record (keycmobt = 'barum')
 *   2. barum  — the room itself, referencing the cmobj
 *   3. babuf  — the hierarchy link row, copying denormalised parent context
 *               from the residence's own babuf row
 *
 * The residence's babuf row is located by joining babuf to balgh on keycmobj
 * — that row exists for every residence regardless of whether any rooms
 * already exist, so this works for first-room creation too.
 *
 * Throws ResidenceNotFoundError if no active residence matches the rentalId.
 * Returns the created Room as it would appear via the GET /rooms endpoint.
 */
export const createRoom = async (input: CreateRoomRequest): Promise<Room> => {
  // 1. Resolve the residence's propertyObjectId (cmobj) — fail fast if missing.
  // Also pull the residence's own babuf timestamp; using it on the new rows
  // makes the new room sort in the same "era" cluster as the residence's
  // existing rooms in Xpand's list views (Xpand sorts by babuf.timestamp DESC).
  const residenceStructure = await prisma.propertyStructure.findFirst({
    where: {
      rentalId: input.rentalId,
      propertyObject: { objectTypeId: 'balgh' },
      NOT: { rentalId: { endsWith: 'X' } },
    },
    select: { residenceId: true, timestamp: true },
  })
  if (!residenceStructure || !residenceStructure.residenceId) {
    throw new ResidenceNotFoundError(input.rentalId)
  }

  // 2. Resolve type id (barut.code is unique).
  const roomType = await prisma.roomType.findUnique({
    where: { code: input.roomTypeCode },
  })
  if (!roomType) {
    throw new Error(`Unknown roomTypeCode: ${input.roomTypeCode}`)
  }

  // 3. Resolve code + caption (auto-derived when not supplied).
  const code = input.code ?? (await getNextRoomCode(input.rentalId))
  const caption = await resolveRoomCaption(
    input.rentalId,
    input.roomTypeCode,
    input.caption
  )

  // 4. Use the residence's own babuf timestamp for all three rows so the
  // new room ties with the existing rooms in the babuf-timestamp sort.
  const timestampVal = residenceStructure.timestamp

  // 5. Flag/usage defaults.
  const shared = input.usage?.shared ? 1 : 0
  const allowPeriodicWorks = input.usage?.allowPeriodicWorks === false ? 0 : 1
  const spaceType = input.usage?.spaceType ?? 1
  const hasToilet = input.features?.hasToilet ? 1 : 0
  const isHeated = input.features?.isHeated === false ? 0 : 2
  const hasThermostatValve = input.features?.hasThermostatValve ? 1 : 0
  const orientation = input.features?.orientation ?? 0

  // 6. Generate IDs.
  const newCmobj = generateXpandId()
  const newRoomId = generateXpandId()
  const newBabuf = generateXpandId()

  // 7. Run the 3-table insert in a single transaction.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO cmobj (keycmobj, keycmobt, bcodetype, objcond, sharekind,
                         energycls, heatingcls, deletemark, timestamp)
      VALUES (${newCmobj}, 'barum', 0, 0, 0, 0, 0, 0, ${timestampVal})
    `

    // bessort omitted: DB default of 0 applies. Inspector adds don't care
    // about display order; ~99.7% of existing rooms in production have 0
    // anyway, so the explicit value never moved the needle.
    await tx.$executeRaw`
      INSERT INTO barum (keybarum, keycmobj, keybarut, code, caption,
                         gemensam, skstatus, roomtype, toilet,
                         heating, thermostat, direction, deletemark,
                         fdate, tdate, timestamp)
      VALUES (${newRoomId}, ${newCmobj}, ${roomType.id}, ${code}, ${caption},
              ${shared}, ${allowPeriodicWorks}, ${spaceType}, ${hasToilet},
              ${isHeated}, ${hasThermostatValve}, ${orientation}, 0,
              '1800-01-01', '2999-12-31', ${timestampVal})
    `

    // Sibling-slot keys (yta/aob/bdl/sys/lok/bps/hyr/uhe/prt/kmp/kmp2) are
    // explicit NULL — rooms never carry those regardless of what the
    // residence row has. Parent hierarchy (cmp/fen/fst/byg/van/lgh/inf) is
    // copied verbatim from the residence's own babuf row.
    await tx.$executeRaw`
      INSERT INTO babuf (
        keybabuf, keycmobj,
        keyobjcmp, keyobjfen, keyobjfst, keyobjbyg, keyobjyta, keyobjaob, keyobjbdl,
        keyobjvan, keyobjsys, keyobjlok, keyobjlgh, keyobjbps, keyobjhyr, keyobjuhe,
        keyobjprt, keyobjrum, keyobjkmp, keyobjkmp2, keyobjinf,
        code, caption,
        cmpcode, cmpcaption, fencode, fencaption,
        fstcode, fstcaption, bygcode, bygcaption,
        ytacode, ytacaption, aobcode, aobcaption, bdlcode, bdlcaption,
        vancode, vancaption, syscode, syscaption,
        lokcode, lokcaption, lghcode, lghcaption,
        bpscode, bpscaption, hyrcode, hyrcaption,
        uhecode, uhecaption, prtcode, prtcaption,
        rumcode, rumcaption,
        kmpcode, kmpcaption, kmpcode2, kmpcapt2,
        hyresid, deletemark, fdate, tdate, timestamp
      )
      SELECT
        ${newBabuf}, ${newCmobj},
        src.keyobjcmp, src.keyobjfen, src.keyobjfst, src.keyobjbyg,
        NULL, NULL, NULL,
        src.keyobjvan, NULL, NULL, src.keyobjlgh, NULL, NULL, NULL,
        NULL, ${newCmobj}, NULL, NULL, src.keyobjinf,
        ${code}, ${caption},
        src.cmpcode, src.cmpcaption, src.fencode, src.fencaption,
        src.fstcode, src.fstcaption, src.bygcode, src.bygcaption,
        NULL, NULL, NULL, NULL, NULL, NULL,
        src.vancode, src.vancaption, NULL, NULL,
        NULL, NULL, src.lghcode, src.lghcaption,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        ${code}, ${caption},
        NULL, NULL, NULL, NULL,
        src.hyresid, 0, '1800-01-01', '2999-12-31', ${timestampVal}
      FROM babuf src
      INNER JOIN balgh res ON res.keycmobj = src.keycmobj
      WHERE src.hyresid = ${input.rentalId}
        AND src.deletemark = 0
        AND res.deletemark = 0
    `
  })

  // 8. Re-fetch via the existing mapped read path so the returned shape
  // matches GET /rooms.
  const [room] = await getRoomsByPropertyObjectIds([newCmobj])
  if (!room) {
    throw new Error(
      `createRoom: row missing after insert (newRoomId=${newRoomId}, newCmobj=${newCmobj})`
    )
  }
  return room
}
