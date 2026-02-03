/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - The file size in bytes
 * @returns Formatted file size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Formats an ISO date string to a localized date string
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "12 Jan 2024")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Validates if a file's MIME type is in the allowed types list
 * @param file - The file to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if file type is allowed, false otherwise
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type)
}

/**
 * Validates if a file's size is within the maximum allowed size
 * @param file - The file to validate
 * @param maxBytes - Maximum allowed size in bytes
 * @returns True if file size is valid, false otherwise
 */
export function validateFileSize(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes
}

/**
 * List of dangerous file extensions that should be blocked
 */
export const dangerousExtensions = [
  '.exe',
  '.dll',
  '.bat',
  '.sh',
  '.app',
  '.msi',
  '.cmd',
  '.scr',
]

/**
 * Validates if a file has a dangerous extension
 * @param filename - The filename to check
 * @returns True if file has a dangerous extension, false otherwise
 */
export function hasDangerousExtension(filename: string): boolean {
  const lowerFilename = filename.toLowerCase()
  return dangerousExtensions.some((ext) => lowerFilename.endsWith(ext))
}
