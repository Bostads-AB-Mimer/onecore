const isBlank = (value: unknown) =>
  value === '' || value === null || value === undefined

export const isFormDirty = (
  initial: Record<string, unknown>,
  current: Record<string, unknown>
): boolean =>
  [...new Set([...Object.keys(initial), ...Object.keys(current)])].some(
    (key) =>
      !(isBlank(initial[key]) && isBlank(current[key])) &&
      initial[key] !== current[key]
  )
