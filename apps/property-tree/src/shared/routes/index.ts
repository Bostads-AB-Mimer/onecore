/**
 * Single source of truth for all internal route paths.
 * Used by both the router configuration and navigation links.
 *
 * Route patterns (e.g. routes.property) are used by the router.
 * Path builders (e.g. paths.property('123')) are used for navigation.
 */
import { generatePath } from 'react-router-dom'

export { generatePath }

export const routes = {
  dashboard: '/',
  properties: '/fastigheter',
  property: '/fastigheter/:propertyId', // -- byts ut mot :propertyCode
  building: '/byggnader/:buildingCode', // klar
  staircase: '/uppgangar/:buildingCode/:staircaseCode', // klar
  residence: '/bostader/:residenceId', // -- byts ut mot :rentalId
  room: '/bostader/:residenceId/rum/:roomCode', // roomCode klar -- byts ut :residenceId mot :rentalId
  parkingSpace: '/bilplatser/:rentalId', // klar
  maintenanceUnit: '/underhallsenheter/:code', // klar
  facility: '/lokaler/:rentalId', // klar
  company: '/foretag/:companyId', // -- byts ut mot :organizationNumber
  tenants: '/hyresgaster',
  tenant: '/hyresgaster/:contactCode', // klar
  rentalBlocks: '/sparrar',
  leases: '/hyreskontrakt',
  inspections: '/besiktningar',
  components: '/komponenter',
  callback: '/callback',
} as const

export type RoutePath = (typeof routes)[keyof typeof routes]

/**
 * Pre-bound path builders for navigation.
 *
 *   paths.property('123')            →  '/fastigheter/123'
 *   paths.building('B01')            →  '/byggnader/B01'
 *   paths.staircase('B01', 'S1')     →  '/uppgangar/B01/S1'
 *   paths.room('R1', 'RM1')          →  '/bostader/R1/rum/RM1'
 */
export const paths = {
  property: (propertyId: string) =>
    generatePath(routes.property, { propertyId }),
  building: (buildingCode: string) =>
    generatePath(routes.building, { buildingCode }),
  staircase: (buildingCode: string, staircaseCode: string) =>
    generatePath(routes.staircase, { buildingCode, staircaseCode }),
  residence: (residenceId: string) =>
    generatePath(routes.residence, { residenceId }),
  room: (residenceId: string, roomCode: string) =>
    generatePath(routes.room, { residenceId, roomCode }),
  parkingSpace: (rentalId: string) =>
    generatePath(routes.parkingSpace, { rentalId }),
  maintenanceUnit: (code: string) =>
    generatePath(routes.maintenanceUnit, { code }),
  facility: (rentalId: string) => generatePath(routes.facility, { rentalId }),
  company: (companyId: string) => generatePath(routes.company, { companyId }),
  tenant: (contactCode: string) => generatePath(routes.tenant, { contactCode }),
}

/**
 * Get the static prefix of a route pattern (everything before the first :param).
 * Useful for checking if a pathname belongs to a given route.
 *
 *   matchesRoute(routes.property, '/fastigheter/123')  →  true
 */
export function matchesRoute(pattern: RoutePath, pathname: string): boolean {
  const prefix = pattern.split(':')[0]
  return pathname.startsWith(prefix)
}
