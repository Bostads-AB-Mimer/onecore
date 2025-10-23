import { registerSchema } from '@onecore/utilities'

import * as types from '@src/types'

export const registerSchemas = () => {
  registerSchema('Residence', types.ResidenceSchema)
  registerSchema('ResidenceDetails', types.ResidenceDetailedSchema)
  registerSchema('ResidenceSearchResult', types.ResidenceSearchResultSchema)
  registerSchema('Building', types.BuildingSchema)
  registerSchema('Component', types.ComponentSchema)
  registerSchema('Property', types.PropertySchema)
  registerSchema('PropertyDetails', types.PropertyDetailsSchema)
  registerSchema('Staircase', types.StaircaseSchema)
  registerSchema('Room', types.RoomSchema)
  registerSchema('Company', types.CompanySchema)
  registerSchema('CompanyDetails', types.CompanyDetailsSchema)
  registerSchema('MaintenanceUnit', types.MaintenanceUnitSchema)
  registerSchema('ResidenceByRentalId', types.ResidenceByRentalIdSchema)
  registerSchema(
    'GetResidenceByRentalIdResponse',
    types.GetResidenceByRentalIdResponseSchema
  )
  registerSchema('ParkingSpace', types.ParkingSpaceSchema)
  registerSchema('FacilityDetails', types.FacilityDetailsSchema)
  registerSchema(
    'GetFacilityByRentalIdResponse',
    types.GetFacilityByRentalIdResponseSchema
  )
}
