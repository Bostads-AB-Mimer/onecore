import { Room } from '@prisma/client'

export function mapDbToRoom(dbRecord: Room) {
  if (!dbRecord) return null
  
  return {
    id: dbRecord.roomId,
    code: dbRecord.roomCode,
    name: dbRecord.name?.trim(),
    usage: {
      shared: Boolean(dbRecord.sharedUse),
      allowPeriodicWorks: Boolean(dbRecord.allowPeriodicWorks),
      spaceType: dbRecord.spaceType,
    },
    features: {
      hasToilet: Boolean(dbRecord.hasToilet),
      isHeated: Boolean(dbRecord.isHeated),
      hasThermostatValve: Boolean(dbRecord.hasThermostatValve),
      orientation: dbRecord.orientation,
    },
    dates: {
      installation: dbRecord.installationDate,
      from: dbRecord.fromDate,
      to: dbRecord.toDate,
      availableFrom: dbRecord.availableFrom,
      availableTo: dbRecord.availableTo,
    },
    sortingOrder: dbRecord.sortingOrder,
    deleted: Boolean(dbRecord.deleteMark),
    timestamp: dbRecord.timestamp,
    roomType: dbRecord.roomTypeId,
  }
}
