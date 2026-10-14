import { format } from 'date-fns'

export function buildImdOutputFilename(
  sourceCsvName: string | undefined,
  kind: 'tenfast' | 'ej-bearbetade',
  processedAt: Date
): string {
  const baseName = sourceCsvName?.replace(/\.csv$/i, '') ?? 'imd'
  return `${baseName}-${kind}-${format(processedAt, 'yyyyMMdd-HHmmss')}.csv`
}
