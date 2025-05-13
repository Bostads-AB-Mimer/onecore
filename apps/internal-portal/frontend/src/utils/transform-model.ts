export const setConditionalFields = (
  source: any,
  matrix: Record<string, readonly string[]>,
  controllerValue: string,
  target: Record<string, any>
) => {
  const activeFields = matrix[controllerValue] ?? []

  activeFields.forEach((fieldPath) => {
    const keys = fieldPath.split('.')
    let src = source
    let tgt = target

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]

      if (i === keys.length - 1) {
        tgt[key] = src[key]
      } else {
        src = src[key] ?? {}
        tgt[key] = tgt[key] ?? {}
        tgt = tgt[key]
      }
    }
  })
}
