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
  property: '/fastigheter/:propertyId',
  building: '/byggnader/:buildingCode', // klar
  staircase: '/uppgångar/:buildingCode/:staircaseId',
  residence: '/bostäder/:residenceId',
  room: '/bostäder/:residenceId/rum/:roomId',
  parkingSpace: '/bilplatser/:rentalId',
  maintenanceUnit: '/underhållsenheter/:code', // klar
  facility: '/lokaler/:rentalId',
  company: '/företag/:companyId',
  tenants: '/hyresgäster',
  tenant: '/hyresgäster/:contactCode',
  rentalBlocks: '/spärrar',
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
 *   paths.staircase('B01', 'S1')     →  '/uppgångar/B01/S1'
 *   paths.room('R1', 'RM1')          →  '/bostäder/R1/rum/RM1'
 */
export const paths = {
  property: (propertyId: string) =>
    generatePath(routes.property, { propertyId }),
  building: (buildingCode: string) =>
    generatePath(routes.building, { buildingCode }),
  staircase: (buildingCode: string, staircaseId: string) =>
    generatePath(routes.staircase, { buildingCode, staircaseId }),
  residence: (residenceId: string) =>
    generatePath(routes.residence, { residenceId }),
  room: (residenceId: string, roomId: string) =>
    generatePath(routes.room, { residenceId, roomId }),
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
