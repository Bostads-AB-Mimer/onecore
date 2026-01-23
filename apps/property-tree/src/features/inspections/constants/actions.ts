/**
 * Inspection Action Constants
 *
 * Centralizes action options by component type.
 * Eliminates ACTION_OPTIONS hardcoded in ActionChecklist.tsx.
 */

// Action type constants
export const ACTION_TYPE = {
  // Wall/Ceiling actions
  PAINTING: 'painting',
  REPAIR: 'repair',
  SPACKLING: 'spackling',
  WALLPAPERING: 'wallpapering',

  // Floor actions
  REPLACEMENT: 'replacement',
  SANDING: 'sanding',
  VARNISHING: 'varnishing',

  // Detail actions
  ADJUSTMENT: 'adjustment',
} as const

export type ActionType = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE]

// Action configuration with labels
export const ACTION_CONFIG = {
  [ACTION_TYPE.PAINTING]: { value: 'painting', label: 'Målning' },
  [ACTION_TYPE.REPAIR]: { value: 'repair', label: 'Reparation' },
  [ACTION_TYPE.SPACKLING]: { value: 'spackling', label: 'Spackling' },
  [ACTION_TYPE.WALLPAPERING]: { value: 'wallpapering', label: 'Tapetsering' },
  [ACTION_TYPE.REPLACEMENT]: { value: 'replacement', label: 'Byte' },
  [ACTION_TYPE.SANDING]: { value: 'sanding', label: 'Slipning' },
  [ACTION_TYPE.VARNISHING]: { value: 'varnishing', label: 'Lackering' },
  [ACTION_TYPE.ADJUSTMENT]: { value: 'adjustment', label: 'Justering' },
} as const

/**
 * Component type definition
 * Represents the type of room component (walls, floor, ceiling, details)
 */
export type ComponentType = 'walls' | 'floor' | 'ceiling' | 'details'

/**
 * Actions grouped by component type
 * Maps each component type to its available actions
 */
export const ACTION_OPTIONS_BY_TYPE: Record<
  ComponentType,
  (typeof ACTION_CONFIG)[ActionType][]
> = {
  walls: [
    ACTION_CONFIG[ACTION_TYPE.PAINTING],
    ACTION_CONFIG[ACTION_TYPE.REPAIR],
    ACTION_CONFIG[ACTION_TYPE.SPACKLING],
    ACTION_CONFIG[ACTION_TYPE.WALLPAPERING],
  ],
  ceiling: [
    ACTION_CONFIG[ACTION_TYPE.PAINTING],
    ACTION_CONFIG[ACTION_TYPE.REPAIR],
    ACTION_CONFIG[ACTION_TYPE.SPACKLING],
    ACTION_CONFIG[ACTION_TYPE.WALLPAPERING],
  ],
  floor: [
    ACTION_CONFIG[ACTION_TYPE.REPAIR],
    ACTION_CONFIG[ACTION_TYPE.REPLACEMENT],
    ACTION_CONFIG[ACTION_TYPE.SANDING],
    ACTION_CONFIG[ACTION_TYPE.VARNISHING],
  ],
  details: [
    ACTION_CONFIG[ACTION_TYPE.REPAIR],
    ACTION_CONFIG[ACTION_TYPE.REPLACEMENT],
    ACTION_CONFIG[ACTION_TYPE.ADJUSTMENT],
  ],
} as const

/**
 * Get available actions for a specific component type
 * @param componentType - The type of component (walls, floor, ceiling, details)
 * @returns Array of action configurations for the component type
 */
export function getActionsForComponentType(componentType: ComponentType) {
  return ACTION_OPTIONS_BY_TYPE[componentType] || []
}

/**
 * Get action label by action value
 * @param action - The action value string
 * @returns The action label or the original value if not found
 */
export function getActionLabel(action: string): string {
  const config = Object.values(ACTION_CONFIG).find((a) => a.value === action)
  return config?.label || action
}

/**
 * Check if an action is valid
 * @param action - The action value to check
 * @returns true if the action is a valid ActionType
 */
export function isValidAction(action: string): action is ActionType {
  return Object.values(ACTION_TYPE).includes(action as ActionType)
}
