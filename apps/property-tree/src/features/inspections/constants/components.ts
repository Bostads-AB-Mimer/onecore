/**
 * Room Component Constants
 *
 * Defines standard room components for inspections.
 * Eliminates COMPONENTS array hardcoded in RoomInspectionMobile.tsx.
 */

import type { components } from '@/services/api/core/generated/api-types'

import type { ComponentType } from './actions'

type InspectionRoom = components['schemas']['InspectionRoom']

/**
 * Component field key type
 * Represents the keys used in InspectionRoom conditions/actions/notes/photos
 */
export type ComponentFieldKey = keyof InspectionRoom['conditions']

/**
 * Component definition
 * Defines a single inspectable component within a room
 */
export interface ComponentDefinition {
  key: ComponentFieldKey
  label: string
  type: ComponentType
  order: number
}

/**
 * Standard room components
 * Ordered list of all inspectable components in a room
 */
export const ROOM_COMPONENTS: readonly ComponentDefinition[] = [
  { key: 'wall1', label: 'Vägg 1', type: 'walls', order: 1 },
  { key: 'wall2', label: 'Vägg 2', type: 'walls', order: 2 },
  { key: 'wall3', label: 'Vägg 3', type: 'walls', order: 3 },
  { key: 'wall4', label: 'Vägg 4', type: 'walls', order: 4 },
  { key: 'floor', label: 'Golv', type: 'floor', order: 5 },
  { key: 'ceiling', label: 'Tak', type: 'ceiling', order: 6 },
] as const

/**
 * Get component definition by key
 * @param key - The component field key (e.g., 'wall1', 'floor')
 * @returns Component definition or undefined if not found
 */
export function getComponentByKey(
  key: ComponentFieldKey
): ComponentDefinition | undefined {
  return ROOM_COMPONENTS.find((c) => c.key === key)
}

/**
 * Get all components of a specific type
 * @param type - The component type (walls, floor, ceiling, details)
 * @returns Array of component definitions matching the type
 */
export function getComponentsByType(
  type: ComponentType
): readonly ComponentDefinition[] {
  return ROOM_COMPONENTS.filter((c) => c.type === type)
}

/**
 * Get all wall components
 * @returns Array of wall component definitions
 */
export function getWallComponents(): readonly ComponentDefinition[] {
  return getComponentsByType('walls')
}

/**
 * Get component label by key
 * @param key - The component field key
 * @returns The component label or the key if not found
 */
export function getComponentLabel(key: ComponentFieldKey): string {
  const component = getComponentByKey(key)
  return component?.label || key
}

/**
 * Check if a key is a valid component field key
 * @param key - The key to check
 * @returns true if the key is a valid component field
 */
export function isValidComponentKey(key: string): key is ComponentFieldKey {
  return ROOM_COMPONENTS.some((c) => c.key === key)
}

/**
 * Get all component keys
 * @returns Array of all component field keys
 */
export function getAllComponentKeys(): ComponentFieldKey[] {
  return ROOM_COMPONENTS.map((c) => c.key)
}

type FetchedComponent = components['schemas']['Component']

/**
 * A row rendered in the inspection form. Either a hardcoded surface default
 * (key matches an InspectionRoom field like 'wall1') or a real component
 * instance fetched from the API (keyed by component.id).
 */
export interface InspectionRow {
  key: string
  label: string
  type: ComponentType
  isDefault: boolean
  componentId?: string
}

// Swedish category names that supersede a default surface row when present in
// the fetched components. Matches the existing DB convention (e.g. 'Vitvaror').
const SURFACE_CATEGORY: Record<string, ComponentType> = {
  Väggar: 'walls',
  Golv: 'floor',
  Tak: 'ceiling',
}

function getCategoryName(component: FetchedComponent): string | undefined {
  return component.model?.subtype?.componentType?.category?.categoryName
}

function getDisplayName(component: FetchedComponent): string {
  return (
    component.model?.subtype?.subTypeName ||
    component.model?.modelName ||
    component.id
  )
}

function getComponentType(component: FetchedComponent): ComponentType {
  const categoryName = getCategoryName(component)
  return (categoryName && SURFACE_CATEGORY[categoryName]) || 'details'
}

/**
 * Merge fetched components with hardcoded surface defaults.
 *
 * Defaults are dropped per type when ANY fetched component carries the
 * matching Swedish category name (Väggar/Golv/Tak). Once Mimer imports real
 * surface components, the defaults disappear entirely. `details` is an
 * inspection-only concept with no API equivalent and is always rendered.
 */
export function mergeComponentsWithDefaults(
  fetched: readonly FetchedComponent[]
): InspectionRow[] {
  const supersededTypes = new Set<ComponentType>()
  for (const component of fetched) {
    const categoryName = getCategoryName(component)
    const supersededType = categoryName && SURFACE_CATEGORY[categoryName]
    if (supersededType) supersededTypes.add(supersededType)
  }

  const defaults: InspectionRow[] = ROOM_COMPONENTS.filter(
    (c) => !supersededTypes.has(c.type)
  ).map((c) => ({
    key: c.key,
    label: c.label,
    type: c.type,
    isDefault: true,
  }))

  const equipment: InspectionRow[] = fetched.map((component) => ({
    key: component.id,
    label: getDisplayName(component),
    type: getComponentType(component),
    isDefault: false,
    componentId: component.id,
  }))

  return [...defaults, ...equipment]
}
