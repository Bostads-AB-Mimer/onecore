import { format } from 'date-fns'

export function formatImdDownloadTimestamp(date: Date): string {
  return format(date, 'yyyyMMdd-HHmmss')
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
