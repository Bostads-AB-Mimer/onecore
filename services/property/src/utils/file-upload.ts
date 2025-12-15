import multer from '@koa/multer'
import type { File } from '@koa/multer'
import { uploadFile, getFileUrl } from '../adapters/minio-adapter'

/**
 * Configuration options for creating a multer upload instance
 */
export interface MulterUploadOptions {
  maxSizeBytes: number
  allowedMimeTypes: string[]
  errorMessage?: string
}

/**
 * Options for generating a file name
 */
export interface FileNameOptions {
  entityType: 'component-instance' | 'component-model'
  entityId: string
  fileType?: string
  originalName: string
}

/**
 * Options for uploading a file and saving its metadata
 */
export interface UploadAndSaveOptions<T> {
  file: File
  fileName: string
  metadataHandler: (fileId: string, file: File) => Promise<T>
}

/**
 * Sanitizes a filename by removing/replacing unsafe characters
 * Keeps: alphanumeric, dots, hyphens, underscores
 * Replaces: spaces with underscores
 * Removes: all other special characters
 *
 * @param filename - Original filename to sanitize
 * @returns Sanitized filename
 *
 * @example
 * ```typescript
 * sanitizeFilename('My Photo (2024) & Test.jpg')
 * // Returns: "My_Photo_2024_Test.jpg"
 *
 * sanitizeFilename("'; DROP TABLE users; --.pdf")
 * // Returns: "DROP_TABLE_users.pdf"
 *
 * sanitizeFilename('Document v2.0 [FINAL].pdf')
 * // Returns: "Document_v2.0_FINAL.pdf"
 * ```
 */
export const sanitizeFilename = (filename: string): string => {
  // Split filename into name and extension
  const parts = filename.split('.')
  const extension = parts.length > 1 ? parts.pop() : ''
  const name = parts.join('.')

  // Replace spaces with underscores
  let sanitized = name.replace(/\s+/g, '_')

  // Keep only alphanumeric, dots, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '')

  // Remove leading/trailing dots, hyphens, underscores
  sanitized = sanitized.replace(/^[._-]+|[._-]+$/g, '')

  // Collapse multiple underscores, dots, hyphens
  sanitized = sanitized.replace(/[_]{2,}/g, '_')
  sanitized = sanitized.replace(/[.]{2,}/g, '.')
  sanitized = sanitized.replace(/[-]{2,}/g, '-')

  // Ensure we have a filename (fallback to 'file' if empty)
  if (!sanitized) {
    sanitized = 'file'
  }

  // Sanitize extension (lowercase, alphanumeric only)
  const cleanExtension = extension
    ? extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    : ''

  // Reconstruct filename
  return cleanExtension ? `${sanitized}.${cleanExtension}` : sanitized
}

/**
 * Creates a configured multer upload instance with memory storage
 *
 * @param options - Configuration for file size limits, allowed types, and error messages
 * @returns Configured multer instance
 *
 * @example
 * ```typescript
 * const imageUpload = createMulterUpload({
 *   maxSizeBytes: 10 * 1024 * 1024, // 10MB
 *   allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
 *   errorMessage: 'Only JPEG, PNG, and WebP images are allowed'
 * })
 * ```
 */
export const createMulterUpload = (options: MulterUploadOptions) => {
  const { maxSizeBytes, allowedMimeTypes, errorMessage } = options

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSizeBytes,
    },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        const error =
          errorMessage ||
          `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
        cb(new Error(error), false)
      }
    },
  })
}

/**
 * Generates a consistent file name for uploaded files
 *
 * @param options - Entity type, ID, optional file type, and original filename
 * @returns Generated filename in the format: {entityType}-{entityId}-[{fileType}-]{timestamp}.{ext}
 *
 * @example
 * ```typescript
 * // Component file
 * generateFileName({
 *   entityType: 'component',
 *   entityId: 'abc123',
 *   originalName: 'photo.jpg'
 * })
 * // Returns: "component-abc123-1234567890.jpg"
 *
 * // Component model document
 * generateFileName({
 *   entityType: 'component-model',
 *   entityId: '123e4567-e89b-12d3-a456-426614174000',
 *   originalName: 'manual.pdf'
 * })
 * // Returns: "component-model-123e4567-e89b-12d3-a456-426614174000-1234567890.pdf"
 * ```
 */
export const generateFileName = (options: FileNameOptions): string => {
  const { entityType, entityId, fileType, originalName } = options
  const timestamp = Date.now()
  const extension = originalName.split('.').pop()

  if (fileType) {
    return `${entityType}-${entityId}-${fileType}-${timestamp}.${extension}`
  }

  return `${entityType}-${entityId}-${timestamp}.${extension}`
}

/**
 * Orchestrates file upload to MinIO and metadata saving to database
 * Automatically sanitizes the original filename before storing metadata
 *
 * @param options - File, filename, and metadata handler function
 * @returns The metadata returned by the handler
 * @throws Error if upload or metadata saving fails
 *
 * @example
 * ```typescript
 * const document = await uploadAndSaveMetadata({
 *   file: ctx.file,
 *   fileName: 'component-model-123-manual-1234567890.pdf',
 *   metadataHandler: async (fileId, file) => {
 *     return await addComponentModelDocument(modelId, {
 *       fileId,
 *       originalName: file.originalname, // Will be sanitized automatically
 *       size: file.size,
 *       mimeType: file.mimetype,
 *     })
 *   }
 * })
 * ```
 */
export const uploadAndSaveMetadata = async <T>(
  options: UploadAndSaveOptions<T>
): Promise<T> => {
  const { file, fileName, metadataHandler } = options

  // Sanitize original filename before storing in metadata
  const sanitizedOriginalName = sanitizeFilename(file.originalname)

  // Upload file to MinIO with originalName in metadata
  const fileId = await uploadFile(
    fileName,
    file.buffer,
    file.mimetype,
    sanitizedOriginalName
  )

  // Create a modified file object with sanitized filename for metadata handler
  const sanitizedFile = {
    ...file,
    originalname: sanitizedOriginalName,
  }

  // Save metadata to database using the provided handler
  const metadata = await metadataHandler(fileId, sanitizedFile)

  return metadata
}

/**
 * Adds presigned URLs to an array of file metadata objects
 *
 * @param files - Array of objects containing fileId
 * @param expirySeconds - URL expiry time in seconds (default: 86400 = 24 hours)
 * @returns Array of objects with added url and expiresIn fields
 *
 * @example
 * ```typescript
 * const files = await getComponentFiles(componentId)
 * const filesWithUrls = await addPresignedUrls(files, 86400)
 * // Returns: [{ ...file, url: 'https://...', expiresIn: 86400 }]
 * ```
 */
export const addPresignedUrls = async <T extends { fileId: string }>(
  files: T[],
  expirySeconds: number = 86400
): Promise<Array<T & { url: string; expiresIn: number }>> => {
  return Promise.all(
    files.map(async (file) => ({
      ...file,
      url: await getFileUrl(file.fileId, expirySeconds),
      expiresIn: expirySeconds,
    }))
  )
}
