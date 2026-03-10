/**
 * Resolve config values from injected config, environment or defaults and
 * in that order.
 *
 * @param vblName - The name of the environment variable to resolve,
 *                  e.g, VITE_KEYCLOAK_URL
 * @param defaultValue - The value to return if neither injected config nor
 *                       env contains a value.
 */
export const resolve = (vblName: string, defaultValue: string) => {
  return window.__ENV?.[vblName] || import.meta.env[vblName] || defaultValue
}
