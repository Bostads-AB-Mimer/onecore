enum LeaseStatus {
  Active,
}

enum ParkingSpaceType {
  WarmGarage,
  ColdGarage,
  ThermalGarage,
  CentralGarage,
  MotorcycleGarage,
  ParkingSpaceWithoutElectricity,
  ParkingSpaceWithElectricity,
  CaravanParkingSpace,
  MotorcycleParkingSpace,
  ParkingDeck,
  Carport,
  Garage,
  ColdGarageWithElectricity,
  CollectiveParkingSpace,
  FreeParkingSpace,
  ParkingSpaceWithElectricityWEBEL,
  VisitorParkingSpace,
  CentralFacilityParkingSpace,
  DisabledParkingPlace,
  ParkingSpaceWithChargingBox,
  CarportWithChargingBox,
}

enum ParkingSpaceApplicationCategory {
  internal = 0,
  external = 1,
}

export { LeaseStatus, ParkingSpaceType, ParkingSpaceApplicationCategory }
