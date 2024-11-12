export type Residence = {
  id: string
  objectId: string
  residenceTypeId: string
  code: string
  name: string
  location?: string | null
  wheelchairAccessible: boolean
  residenceAdapted: boolean
  balcony1Location?: string | null
  balcony2Location?: string | null
  balcony1Type?: string | null
  balcony2Type?: string | null
  patioLocation?: string | null
  hygieneFacility: string
  sauna: boolean
  extraToilet: boolean
  sharedKitchen: boolean
  petAllergyFree: boolean
  electricAllergyIntolerance: boolean
  smokeFree: boolean
  elevator: boolean
  asbestos: boolean
  entrance: string
  partNo: number
  part: string
  deleted: boolean
  fromDate: Date
  toDate: Date
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
