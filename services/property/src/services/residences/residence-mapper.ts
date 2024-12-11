import { ResidenceWithRelations } from '../../adapters/residence-adapter'
import { ResidenceSchema, Residence } from '../../types/residence'

export function mapDbToResidence(dbRecord: ResidenceWithRelations): Residence {
  if (!dbRecord) return {} as Residence
  return ResidenceSchema.parse({
    id: dbRecord.id.trim(),
    code: dbRecord.code,
    name: dbRecord.name,
    accessibility: {
      wheelchairAccessible: Boolean(dbRecord.wheelchairAccessible),
      residenceAdapted: Boolean(dbRecord.residenceAdapted),
      elevator: Boolean(dbRecord.elevator),
    },
    location: dbRecord.location || undefined,
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
      sauna: Boolean(dbRecord.sauna),
      extraToilet: Boolean(dbRecord.extraToilet),
      sharedKitchen: Boolean(dbRecord.sharedKitchen),
      petAllergyFree: Boolean(dbRecord.petAllergyFree),
      electricAllergyIntolerance: Boolean(dbRecord.electricAllergyIntolerance),
      smokeFree: Boolean(dbRecord.smokeFree),
      asbestos: Boolean(dbRecord.asbestos),
    },
    /*rooms: // activate when rooms are implemented
      dbRecord.rooms?.map((room: any) => ({
        id: room.id,
        code: room.code,
        name: room.name,
        usage: {
          shared: room.shared === 1,
          allowPeriodicWorks: room.allowPeriodicWorks === 1,
        },
        fromDate: new Date(room.fromDate),
        toDate: new Date(room.toDate),
        availableFrom: room.availableFrom
          ? new Date(room.availableFrom)
          : undefined,
        availableTo: room.availableTo
          ? new Date(room.availableTo)
          : undefined,
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
        },
        deleteMark: room.deleteMark === 1,
        timestamp: room.timestamp,
      })) || [],*/
    entrance: dbRecord.entrance,
    partNo: dbRecord.partNo || 0,
    part: dbRecord.part || '',
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
      systemStandard: dbRecord.residenceType.systemStandard || 0,
      residenceTypeId: dbRecord.residenceType.id,
      checklistId: dbRecord.residenceType.checklistId,
      componentTypeActionId: dbRecord.residenceType.componentTypeActionId,
      statisticsGroupSCBId: dbRecord.residenceType.statisticsGroupSCBId,
      statisticsGroup2Id: dbRecord.residenceType.statisticsGroup2Id,
      statisticsGroup3Id: dbRecord.residenceType.statisticsGroup3Id,
      statisticsGroup4Id: dbRecord.residenceType.statisticsGroup4Id,
      timestamp: dbRecord.residenceType.timestamp,
    },
    propertyObject: {
      energy: {
        energyClass: dbRecord.propertyObject.energyClass,
        heatingNature: dbRecord.propertyObject.heatingNature,
        // .. add more fields when needed
      },
    },
    links: {
      building: dbRecord.propertyObject?.building?.buildingCode,
      property: dbRecord.propertyObject?.property?.code,
      _links: {
        self: {
          href: `/residences/${dbRecord.id.trim()}`,
        },
        building: dbRecord.propertyObject?.building?.buildingCode
          ? {
              href: `/buildings/byCode/${dbRecord.propertyObject.building?.buildingCode}`,
            }
          : undefined,
        property: dbRecord.propertyObject?.property?.code
          ? {
              href: `/properties/${dbRecord.propertyObject.property?.code}`,
            }
          : undefined,
      },
    },
  })
}
