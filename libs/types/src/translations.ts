import {
  InvoiceTransactionType,
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
  PaymentStatus,
} from './enums'

// Keys from Xpand DB table BABPT
export const parkingSpaceTypeTranslation: Record<string, ParkingSpaceType> = {
  VARMG: ParkingSpaceType.WarmGarage,
  KALLG: ParkingSpaceType.ColdGarage,
  TERMOG: ParkingSpaceType.ThermalGarage,
  CENTG: ParkingSpaceType.CentralGarage,
  MCGAR: ParkingSpaceType.MotorcycleGarage,
  PPLUEL: ParkingSpaceType.ParkingSpaceWithoutElectricity,
  PPLMEL: ParkingSpaceType.ParkingSpaceWithElectricity,
  HUSVPL: ParkingSpaceType.CaravanParkingSpace,
  MCPPL: ParkingSpaceType.MotorcycleParkingSpace,
  PDÄCK: ParkingSpaceType.ParkingDeck,
  CPORT: ParkingSpaceType.Carport,
  GARAGE: ParkingSpaceType.Garage,
  KGAREL: ParkingSpaceType.ColdGarageWithElectricity,
  SAMPPL: ParkingSpaceType.CollectiveParkingSpace,
  PPLFRI: ParkingSpaceType.FreeParkingSpace,
  PPLWEB: ParkingSpaceType.ParkingSpaceWithElectricityWEBEL,
  PBESÖK: ParkingSpaceType.VisitorParkingSpace,
  CENTER: ParkingSpaceType.CentralFacilityParkingSpace,
  PHKP: ParkingSpaceType.DisabledParkingPlace,
  LADDBOX: ParkingSpaceType.ParkingSpaceWithChargingBox,
  CPORTMBOX: ParkingSpaceType.CarportWithChargingBox,
}

// Keys from the mimer.nu api.
export const parkingSpaceApplicationCategoryTranslation: Record<
  string,
  ParkingSpaceApplicationCategory
> = {
  'Bilplats (extern)': ParkingSpaceApplicationCategory.external,
  'Bilplats (intern)': ParkingSpaceApplicationCategory.internal,
}

// Keys from Xpand DB table REVRT
export const invoiceTransactionTypeTranslation: Record<
  string,
  InvoiceTransactionType
> = {
  _S2Y14GIUN: InvoiceTransactionType.Rent,
  PAMIN1: InvoiceTransactionType.Reminder,
  PAMIN2: InvoiceTransactionType.DebtCollection,
  AMORTINV: InvoiceTransactionType.RedemptionPlan,
  _3XJ0UFUFVANHJS: InvoiceTransactionType.AbandondenRedemptionPlan,
}

// Keys from Xpand DB table KRFKH
export const paymentStatusTranslation: Record<number, PaymentStatus> = {
  0: PaymentStatus.Unpaid,
  1: PaymentStatus.Unpaid,
  2: PaymentStatus.Paid,
  3: PaymentStatus.Paid,
  4: PaymentStatus.Paid,
  5: PaymentStatus.Paid,
  6: PaymentStatus.Paid,
  7: PaymentStatus.Paid,
}
