import { Residence } from '../../types/residence'

export function mapDbToResidence(dbRecord: any): Residence {
  return {
    id: dbRecord.id,
    code: dbRecord.code,
    name: dbRecord.name,
    location: dbRecord.location,
    accessibility: {
      wheelchairAccessible: dbRecord.wheelchairAccessible === 1,
      residenceAdapted: dbRecord.residenceAdapted === 1,
      elevator: dbRecord.elevator === 1,
    },
    features: {
      balcony1: dbRecord.balcony1 ? { location: dbRecord.balcony1Location, type: dbRecord.balcony1Type } : undefined,
      balcony2: dbRecord.balcony2 ? { location: dbRecord.balcony2Location, type: dbRecord.balcony2Type } : undefined,
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
    entrance: dbRecord.entrance,
    partNo: dbRecord.partNo,
    part: dbRecord.part,
    deleted: dbRecord.deleted === 1,
    validityPeriod: {
      fromDate: new Date(dbRecord.fromDate),
      toDate: new Date(dbRecord.toDate),
    },
    timestamp: dbRecord.timestamp,
    residenceType: {
      code: dbRecord.residenceTypeCode,
      name: dbRecord.residenceTypeName,
      roomCount: dbRecord.roomCount,
      kitchen: dbRecord.kitchen,
      selectionFundAmount: dbRecord.selectionFundAmount,
    },
    propertyObject: {
      energy: {
        energyClass: dbRecord.energyClass,
        energyRegistered: dbRecord.energyRegistered ? new Date(dbRecord.energyRegistered) : undefined,
        energyReceived: dbRecord.energyReceived ? new Date(dbRecord.energyReceived) : undefined,
        energyIndex: dbRecord.energyIndex,
      },
    },
  }
}
