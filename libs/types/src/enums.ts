enum LeaseStatus {
  Current = 0, // Gällande
  Upcoming = 1, // Kommande
  AboutToEnd = 2, // Uppsagt, kommer att upphöra
  Ended = 3, //Upphört
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
  Active = 1, //Publicerad
  Assigned = 2,
  Closed = 3,
  Expired = 4,
}

enum ApplicantStatus {
  Active = 1,
  Assigned = 2,
  AssignedToOther = 3,
  WithdrawnByUser = 4,
  WithdrawnByManager = 5,
  Offered = 6,
  OfferAccepted = 7,
  OfferDeclined = 8,
  OfferExpired = 9,
  //PendingReview = 6 // ?
  //Rejected = 7 // ?
}

enum OfferStatus {
  Active = 1,
  Accepted = 2,
  Declined = 3,
  Expired = 4,
}

enum WaitingListType {
  ParkingSpace = 1,
}

export {
  LeaseStatus,
  ParkingSpaceType,
  ParkingSpaceApplicationCategory,
  PaymentStatus,
  InvoiceTransactionType,
  ListingStatus,
  ApplicantStatus,
  OfferStatus,
  WaitingListType,
}
