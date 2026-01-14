import { z } from 'zod'

/**
 * Basic file info returned by /files endpoint (list files)
 * Aligned with MinIO's BucketItem type (after JSON serialization)
 */
export const FileListItemSchema = z.object({
  name: z.string().describe('Full file path/name'),
  lastModified: z.string().datetime().describe('ISO 8601 timestamp'),
  etag: z.string().describe('ETag for file version'),
  size: z.number().int().nonnegative().describe('File size in bytes'),
})

/**
 * Full file metadata from /files/{fileName}/metadata endpoint
 * Aligned with MinIO's BucketItemStat type (after JSON serialization)
 */
export const FileMetadataSchema = FileListItemSchema.extend({
  metaData: z.record(z.string()).optional().describe('Custom metadata key-value pairs'),
})

/**
 * Request body for file upload
 */
export const FileUploadRequestSchema = z.object({
  fileName: z.string().min(1).describe('Target file name/path'),
  fileData: z.string().describe('Base64 encoded file content'),
  contentType: z.string().describe('MIME type of the file'),
})

/**
 * Response from file upload endpoint
 */
export const FileUploadResponseSchema = z.object({
  fileName: z.string().describe('Stored file name/path'),
  message: z.string().describe('Success message'),
})

/**
 * Response from get file URL endpoint
 */
export const FileUrlResponseSchema = z.object({
  url: z.string().url().describe('Presigned download URL'),
  expiresIn: z.number().int().positive().describe('URL expiry time in seconds'),
})

/**
 * Response from file exists endpoint
 */
export const FileExistsResponseSchema = z.object({
  exists: z.boolean().describe('Whether the file exists'),
})

/**
 * Response from list files endpoint
 */
export const ListFilesResponseSchema = z.object({
  files: z.array(FileListItemSchema).describe('Array of file metadata objects'),
})

/**
 * Query parameters for list files endpoint
 */
export const ListFilesQuerySchema = z.object({
  prefix: z.string().optional().describe('Filter files by prefix'),
})

/**
 * Query parameters for get file URL endpoint
 */
export const FileUrlQuerySchema = z.object({
  expirySeconds: z.coerce.number().int().positive().default(3600).describe('URL expiry time'),
})

// Export TypeScript types
export type FileListItem = z.infer<typeof FileListItemSchema>
export type FileMetadata = z.infer<typeof FileMetadataSchema>
export type FileUploadRequest = z.infer<typeof FileUploadRequestSchema>
export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>
export type FileUrlResponse = z.infer<typeof FileUrlResponseSchema>
export type FileExistsResponse = z.infer<typeof FileExistsResponseSchema>
export type ListFilesResponse = z.infer<typeof ListFilesResponseSchema>
export type ListFilesQuery = z.infer<typeof ListFilesQuerySchema>
export type FileUrlQuery = z.infer<typeof FileUrlQuerySchema>
