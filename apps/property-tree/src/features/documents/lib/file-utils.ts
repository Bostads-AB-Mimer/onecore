export const FILE_TYPE_MAP: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  xls: 'Excel',
  xlsx: 'Excel',
  dwg: 'DWG',
  jpg: 'Bild',
  jpeg: 'Bild',
  png: 'Bild',
  gif: 'Bild',
  txt: 'Text',
  zip: 'Arkiv',
  rar: 'Arkiv',
}

export const extractFileName = (fullPath: string, prefix: string): string => {
  return fullPath.replace(prefix, '')
}

export const getFileTypeFromName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return FILE_TYPE_MAP[extension || ''] || 'Okänd'
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
