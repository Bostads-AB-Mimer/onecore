import { LeaseType } from '@onecore/types'

//constant values for lease.type
//string values taken from xpand

const leaseTypes = {
  housingContract: LeaseType.HousingContract,
  campusContract: LeaseType.CampusContract,
  garageContract: LeaseType.GarageContract,
  cooperativeTenancyContract: LeaseType.CooperativeTenancyContract,
  commercialTenantContract: LeaseType.CommercialTenantContract,
  renegotiationContract: LeaseType.RenegotiationContract,
  otherContract: LeaseType.OtherContract,
  parkingspaceContract: LeaseType.ParkingSpaceContract,
}

export { leaseTypes }
