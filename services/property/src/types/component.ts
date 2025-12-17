/**
 * Barrel export file for component types
 * Split into 6 entity files to improve maintainability:
 * - component-category.ts: Categories (e.g., "HVAC", "Plumbing")
 * - component-type.ts: Types within categories (e.g., "Boiler", "Radiator")
 * - component-subtype.ts: Specific subtypes (e.g., "Electric Boiler", "Gas Boiler")
 * - component-model.ts: Manufacturer models (e.g., "Bosch Series 5000")
 * - component-instance.ts: Physical instances with serial numbers
 * - component-installation.ts: Installation records (where/when installed)
 */

export * from './component-category'
export * from './component-type'
export * from './component-subtype'
export * from './component-model'
export * from './component-instance'
export * from './component-installation'
