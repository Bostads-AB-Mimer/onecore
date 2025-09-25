/* Just hardcoded feature toggles for now. In a real app these would probably come from an API or be set per environment */

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
}

export const featureToggles: FeatureToggles = {
  showNavigation: true,
  showRentals: true,
  showDesignSystem: true,
  showProperties: true,
  showTenants: true,
  showBuildings: true,
  showApartments: true,
  showRoomInformation: true,
  showInspections: false,
  showApartmentIssues: false,
  showResidenceNotes: true,
  showTenantInfo: true,
  showDocuments: true,
  showFloorplan: true,
  showResidenceAccess: true,
  // Tenant detail page tabs
  showTenantContracts: true,
  showTenantQueue: false,
  showTenantCases: false,
  showTenantLedger: true,
  showTenantNotes: true,
  showTenantKeys: false,
  showTenantEvents: false,
  showTenantDocuments: true,
  // Rentals sections
  showRentalsHousing: true,
  showRentalsParking: true,
  showRentalsStorage: true,
  // Property detail page tabs
  showPropertyInfo: true,
  showPropertyStatistics: true,
  showPropertyDocuments: true,
  showPropertyPlanning: false,
  showPropertyBuildings: true,
  showPropertyMaintenance: false,
  showPropertyOrders: false,
  showPropertyAccess: false,
  showPropertyMap: true,
  // Building detail page tabs
  showBuildingEntrances: true,
  showBuildingParts: false,
  showBuildingSpaces: true,
  showBuildingInstallations: false,
  showBuildingParking: false,
  showBuildingDocuments: true,
  // Barriers (Spärrar)
  showBarriers: false,
  // Turnover (In- och utflytt)
  showTurnover: false,
}
