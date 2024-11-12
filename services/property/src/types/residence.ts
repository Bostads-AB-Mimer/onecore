export type Residence = {
  id: string
  // objectId: string
  // residenceTypeId: string
  code: string
  name: string
  location?: string
  accessibility: {
    wheelchairAccessible: boolean
    residenceAdapted: boolean
    elevator: boolean
  }
  features: {
    balcony1?: {
      location: string
      type: string
    }
    balcony2?: {
      location: string
      type: string
    }
    patioLocation?: string
    hygieneFacility: string
    sauna: boolean
    extraToilet: boolean
    sharedKitchen: boolean
    petAllergyFree: boolean
    electricAllergyIntolerance: boolean
    smokeFree: boolean
    asbestos: boolean
  }
  rooms: {
    roomType: string
    roomSize: number
    roomCount: number
  }[]
  entrance: string
  partNo: number
  part: string
  deleted: boolean
  validityPeriod: {
    fromDate: Date
    toDate: Date
  }
  timestamp: string
  residenceType: {
    code: string
    name: string
    roomCount: number
    kitchen: number
    selectionFundAmount: number
  }
  propertyObject: {
    // propertyObjectId: string
    // objectTypeId: string
    // barcode?: string
    // barcodeType: number
    // condition: number
    // conditionInspectionDate?: Date
    // vatAdjustmentPrinciple: number
    energy: {
      energyClass: number
      energyRegistered?: Date
      energyReceived?: Date
      energyIndex?: number
    }
    // heatingNature: number
    // deleteMark: boolean
    // timestamp: string
    // property?: any
    // rentalObject?: any
    // building?: any
  }
}
