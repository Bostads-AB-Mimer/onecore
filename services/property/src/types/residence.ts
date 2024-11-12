export type Residence = {
  id: string
  objectId: string
  residenceTypeId: string
  code: string
  name: string
  location?: string | null
  accessibility: {
    wheelchairAccessible: boolean
    residenceAdapted: boolean
    elevator: boolean
  }
  features: {
    balcony1?: {
      location: string | null
      type: string | null
    }
    balcony2?: {
      location: string | null
      type: string | null
    }
    patioLocation?: string | null
    hygieneFacility: string
    sauna: boolean
    extraToilet: boolean
    sharedKitchen: boolean
    petAllergyFree: boolean
    electricAllergyIntolerance: boolean
    smokeFree: boolean
    asbestos: boolean
  }
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
    propertyObjectId: string
    objectTypeId: string
    barcode?: string | null
    barcodeType: number
    condition: number
    conditionInspectionDate?: Date | null
    vatAdjustmentPrinciple: number
    energyClass: number
    energyRegistered?: Date | null
    energyReceived?: Date | null
    energyIndex?: number | null
    heatingNature: number
    deleteMark: boolean
    timestamp: string
    property?: any
    rentalObject?: any
    building?: any
  }
}
