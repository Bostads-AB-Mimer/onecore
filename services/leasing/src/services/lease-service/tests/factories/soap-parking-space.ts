import { Factory } from 'fishery'

type SoapInternalParkingSpace = {
  RentalObjectCode: string
  Address1: string
  MonthRent: number
  ObjectTypeCaption: string
  ObjectTypeCode: string
  RentalObjectTypeCaption: string
  RentalObjectTypeCode: 'STD'
  PublishedFrom: string
  PublishedTo: string
  VacantFrom: string
  WaitingListType: string
}

export const SoapInternalParkingSpaceFactory =
  Factory.define<SoapInternalParkingSpace>(({ sequence }) => ({
    RentalObjectCode: `R${sequence + 1000}`,
    Address1: 'Sample Address',
    MonthRent: 1000,
    ObjectTypeCaption: 'Carport',
    ObjectTypeCode: 'CPORT',
    RentalObjectTypeCaption: 'Standard hyresobjektstyp',
    RentalObjectTypeCode: 'STD',
    PublishedFrom: new Date().toISOString(),
    PublishedTo: new Date().toISOString(),
    VacantFrom: new Date().toISOString(),
    WaitingListType: 'Bilplats (intern)',
  }))
