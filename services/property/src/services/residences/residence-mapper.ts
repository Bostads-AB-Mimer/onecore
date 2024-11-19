import { Residence, ResidenceSchema } from '../../types/residence'
import { Prisma } from '@prisma/client'

export function mapDbToResidence(
  dbRecord: Prisma.ResidenceGetPayload<{
    include: { /*rooms: true;*/ residenceType: true; propertyObject: true }
  }>,
): Residence {
  if (!dbRecord) return {} as Residence
  return ResidenceSchema.parse({
    id: dbRecord.residenceId,
    code: dbRecord.code,
    name: dbRecord.name,
    location: dbRecord.location,
    accessibility: {
      wheelchairAccessible: dbRecord.wheelchairAccessible === 1,
      residenceAdapted: dbRecord.residenceAdapted === 1,
      elevator: dbRecord.elevator === 1,
    },
    features: {
      balcony1: {
        location: dbRecord.balcony1Location,
        type: dbRecord.balcony1Type,
      },
      balcony2: {
        location: dbRecord.balcony2Location,
        type: dbRecord.balcony2Type,
      },
      patioLocation: dbRecord.patioLocation,
      hygieneFacility: dbRecord.hygieneFacility,
      sauna: dbRecord.sauna === 1,
      extraToilet: dbRecord.extraToilet === 1,
      sharedKitchen: dbRecord.sharedKitchen === 1,
      petAllergyFree: dbRecord.petAllergyFree === 1,
      electricAllergyIntolerance: dbRecord.electricAllergyIntolerance === 1,
      smokeFree: dbRecord.smokeFree === 1,
      asbestos: dbRecord.asbestos === 1,
    },
    /*rooms: // activate when rooms are implemented
      dbRecord.rooms?.map((room: any) => ({
        id: room.roomId,
        code: room.roomCode,
        name: room.name,
        usage: {
          shared: room.sharedUse === 1,
          allowPeriodicWorks: room.allowPeriodicWorks === 1,
        },
        specifications: {
          spaceType: room.spaceType,
          hasToilet: room.hasToilet === 1,
          isHeated: room.isHeated,
          hasThermostatValve: room.hasThermostatValve === 1,
          orientation: room.orientation,
        },
        dates: {
          installation: room.installationDate
            ? new Date(room.installationDate)
            : undefined,
          from: new Date(room.fromDate),
          to: new Date(room.toDate),
          availableFrom: room.availableFrom
            ? new Date(room.availableFrom)
            : undefined,
          availableTo: room.availableTo
            ? new Date(room.availableTo)
            : undefined,
        },
        deleteMark: room.deleteMark === 1,
        timestamp: room.timestamp,
      })) || [],*/
    entrance: dbRecord.entrance,
    //partNo: dbRecord.partNo,
    //part: dbRecord.part,
    deleted: dbRecord.deleted === 1,
    validityPeriod: {
      fromDate: new Date(dbRecord.fromDate),
      toDate: new Date(dbRecord.toDate),
    },
    residenceType: {
      code: dbRecord.residenceType.code,
      name: dbRecord.residenceType.name,
      roomCount: dbRecord.residenceType.roomCount,
      kitchen: dbRecord.residenceType.kitchen,
      systemStandard: dbRecord.residenceType.systemStandard,
    },
    propertyObject: {
      energy: {
        energyClass: dbRecord.propertyObject.energyClass,
        heatingNature: dbRecord.propertyObject.heatingNature,
        // .. add more fields when needed
      },
    },
  })
}
