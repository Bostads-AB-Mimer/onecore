// Realm role carried in the JWT's realm_access.roles. Members of the
// "Förvaltningsområden" Keycloak group have it assigned via role mapping.
// Backend PATCH endpoints (MIM-1780, MIM-1781) gate on this constant; the FE
// exposes the same flag via the /cost-centers/:id/tree capability response.
export const PROPERTY_AREA_WRITE_ROLE = 'property-areas:write'

export const PROPERTY_MANAGER_ROLE = 'property-manager'
export const DISTRICT_MANAGER_ROLE = 'district-manager'
export const DEPUTY_DISTRICT_MANAGER_ROLE = 'deputy-district-manager'
