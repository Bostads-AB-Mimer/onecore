/**
 * File size limits in bytes
 */
export const FILE_SIZE_LIMITS = {
  /** Maximum size for image files: 50MB */
  IMAGES: 50 * 1024 * 1024,
  /** Maximum size for document files: 50MB */
  DOCUMENTS: 50 * 1024 * 1024,
} as const

/**
 * Allowed MIME types for image uploads
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/**
 * Allowed MIME types for document uploads
 */
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'] as const

/**
 * Human-readable file size limits for display
 */
export const FILE_SIZE_LIMIT_DISPLAY = {
  IMAGES: '50MB',
  DOCUMENTS: '50MB',
} as const

/**
 * Accepted file extensions for HTML file input
 */
export const ACCEPT_PATTERNS = {
  IMAGES: 'image/jpeg,image/png,image/webp',
  DOCUMENTS: 'application/pdf',
} as const
