import type { KeySystem } from '@/services/types'

type KeySystemNameAndCode = Pick<KeySystem, 'name' | 'systemCode'>

/**
 * Short label for a key system: its name, or its code when the name is blank.
 */
export function formatKeySystemLabel(keySystem: KeySystemNameAndCode): string {
  return keySystem.name.trim() || keySystem.systemCode.trim()
}

/**
 * Full description of a key system, e.g. "Kvarteret Svalan (KS-123)".
 * Falls back to the code alone when the name is blank.
 */
export function formatKeySystemTooltip(
  keySystem: KeySystemNameAndCode
): string {
  const name = keySystem.name.trim()
  const code = keySystem.systemCode.trim()
  return name ? `${name} (${code})` : code
}
