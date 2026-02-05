/**
 * Barrel export file for component adapters
 *
 * This file re-exports all component-related adapter functions from their
 * individual files to maintain backward compatibility with existing imports.
 *
 * Split into 6 entity adapter files:
 * - component-category-adapter.ts: ComponentCategory CRUD operations
 * - component-type-adapter.ts: ComponentType CRUD operations
 * - component-subtype-adapter.ts: ComponentSubtype CRUD operations
 * - component-model-adapter.ts: ComponentModel CRUD + document management
 * - component-instance-adapter.ts: Component instance CRUD + file management + by-room queries
 * - component-installation-adapter.ts: ComponentInstallation CRUD operations
 */

export * from './component-category-adapter'
export * from './component-type-adapter'
export * from './component-subtype-adapter'
export * from './component-model-adapter'
export * from './component-instance-adapter'
export * from './component-installation-adapter'
