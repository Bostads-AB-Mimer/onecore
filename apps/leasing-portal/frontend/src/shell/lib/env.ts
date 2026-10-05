/** Resolve config from injected runtime config, then build env, then default. */
export const resolve = (vblName: string, defaultValue: string) => {
  return window.__ENV?.[vblName] || import.meta.env[vblName] || defaultValue
}
