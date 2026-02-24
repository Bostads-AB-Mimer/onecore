/**
 * Custom query serializer that properly handles arrays by creating duplicate parameters
 * For example: { installationDate: ['>=2020-01-01', '<=2025-01-01'] }
 * becomes: ?installationDate=>=2020-01-01&installationDate=<=2025-01-01
 */
export function querySerializer(params: Record<string, any>): string {
  const urlParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Add each array element as a separate parameter with the same key
      value.forEach((v) => {
        if (v !== undefined && v !== null) {
          urlParams.append(key, String(v))
        }
      })
    } else if (value !== undefined && value !== null) {
      urlParams.append(key, String(value))
    }
  })

  return urlParams.toString()
}
