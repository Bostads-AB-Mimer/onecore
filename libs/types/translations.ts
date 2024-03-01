import {
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
} from './enums.js';

// Keys are from Xpand DB table BABPT
export const parkingSpaceTypeTranslation: Record<
  string,
  ParkingSpaceType
> = {
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
};

// Keys are from the mimer.nu api.
export const parkingSpaceApplicationCategoryTranslation: Record<
  string,
  ParkingSpaceApplicationCategory
> = {
  'Bilplats (extern)': ParkingSpaceApplicationCategory.external,
  'Bilplats (intern)': ParkingSpaceApplicationCategory.internal,
};
