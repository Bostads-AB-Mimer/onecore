export function formatImdDownloadTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

export function buildImdOutputFilename(
  sourceCsvName: string | undefined,
  kind: 'tenfast' | 'ej-bearbetade',
  processedAt: Date
): string {
  const baseName = sourceCsvName?.replace(/\.csv$/i, '') ?? 'imd'
  const stamp = formatImdDownloadTimestamp(processedAt)
  return `${baseName}-${kind}-${stamp}.csv`
}
