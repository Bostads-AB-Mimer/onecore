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

enum InvoiceTransactionType {
  Rent = 1,
  Reminder = 10,
  DebtCollection = 11,
  RedemptionPlan = 12,
  AbandondenRedemptionPlan = 13,
  Other = 100,
}

enum PaymentStatus {
  Paid = 1,
  Unpaid = 2,
}

enum ListingStatus {
  Active = 1,
  Assigned = 2,
  Deleted = 3,
}

enum ApplicantStatus {
  Active = 1,
  Assigned = 2,
  AssignedToOther = 3,
  WithdrawnByUser = 4,
  WithdrawnByManager = 5,
  //PendingReview = 6 // ?
  //Rejected = 7 // ?
}

export {
  LeaseStatus,
  ParkingSpaceType,
  ParkingSpaceApplicationCategory,
  PaymentStatus,
  InvoiceTransactionType,
  ListingStatus,
  ApplicantStatus
}
