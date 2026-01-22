interface FeatureToggles {
  showNavigation: boolean
  showRentals: boolean
  showDesignSystem: boolean
  showProperties: boolean
  showTenants: boolean
  showBuildings: boolean
  showApartments: boolean
  showRoomInformation: boolean
  showInspections: boolean
  showApartmentIssues: boolean
  showResidenceNotes: boolean
  showTenantInfo: boolean
  showDocuments: boolean
  showFloorplan: boolean
  showResidenceAccess: boolean
  // Tenant detail page tabs
  showTenantContracts: boolean
  showTenantQueue: boolean
  showTenantCases: boolean
  showTenantLedger: boolean
  showTenantNotes: boolean
  showTenantKeys: boolean
  showTenantEvents: boolean
  showTenantDocuments: boolean
  // Rentals sections
  showRentalsHousing: boolean
  showRentalsParking: boolean
  showRentalsStorage: boolean
  // Property detail page tabs
  showPropertyInfo: boolean
  showPropertyStatistics: boolean
  showPropertyDocuments: boolean
  showPropertyPlanning: boolean
  showPropertyBuildings: boolean
  showPropertyMaintenance: boolean
  showPropertyOrders: boolean
  showPropertyAccess: boolean
  showPropertyMap: boolean
  // Building detail page tabs
  showBuildingEntrances: boolean
  showBuildingParts: boolean
  showBuildingSpaces: boolean
  showBuildingInstallations: boolean
  showBuildingParking: boolean
  showBuildingDocuments: boolean
  // Barriers (Spärrar)
  showBarriers: boolean
  // Turnover (In- och utflytt)
  showTurnover: boolean
  // Global inspections view
  showAllInspections: boolean
  // Dashboard cards
  showDashboardEconomy: boolean
  showDashboardContracts: boolean
  showDashboardLocks: boolean
  showDashboardOdoo: boolean
  showDashboardGreenview: boolean
  showDashboardCurves: boolean
}

const DEFAULT_FEATURES: FeatureToggles = {
  showNavigation: true,
  showRentals: false,
  showDesignSystem: false,
  showProperties: true,
  showTenants: false,
  showBuildings: true,
  showApartments: true,
  showRoomInformation: false,
  showInspections: true,
  showApartmentIssues: false,
  showResidenceNotes: false,
  showTenantInfo: false,
  showDocuments: false,
  showFloorplan: false,
  showResidenceAccess: false,
  // Tenant detail page tabs
  showTenantContracts: false,
  showTenantQueue: false,
  showTenantCases: false,
  showTenantLedger: false,
  showTenantNotes: false,
  showTenantKeys: false,
  showTenantEvents: true,
  showTenantDocuments: true,
  // Rentals sections
  showRentalsHousing: false,
  showRentalsParking: false,
  showRentalsStorage: false,
  // Property detail page tabs
  showPropertyInfo: true,
  showPropertyStatistics: true,
  showPropertyDocuments: true,
  showPropertyPlanning: false,
  showPropertyBuildings: true,
  showPropertyMaintenance: true,
  showPropertyOrders: true,
  showPropertyAccess: false,
  showPropertyMap: true,
  // Building detail page tabs
  showBuildingEntrances: true,
  showBuildingParts: false,
  showBuildingSpaces: false,
  showBuildingInstallations: false,
  showBuildingParking: false,
  showBuildingDocuments: true,
  // Barriers (Spärrar)
  showBarriers: true,
  // Turnover (In- och utflytt)
  showTurnover: false,
  // Global inspections view
  showAllInspections: true,
  // Dashboard cards
  showDashboardEconomy: false,
  showDashboardContracts: false,
  showDashboardLocks: false,
  showDashboardOdoo: false,
  showDashboardGreenview: false,
  showDashboardCurves: false,
}

export function useFeatureToggles() {
  return {
    features: DEFAULT_FEATURES,
  }
}
