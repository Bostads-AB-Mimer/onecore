import { Context, Next } from 'koa'
import { Knex } from 'knex'
import { z } from 'zod'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { uploadFile, getFileUrl, deleteFile } from '../services/key-service/adapters/minio'

/**
 * Generic File Upload/Download Route Factory
 *
 * This utility provides reusable MinIO file upload/download/delete handlers
 * that can be used across different entities (receipts, key-systems, etc.)
 *
 * Design Goals:
 * - Eliminate code duplication across route handlers
 * - Provide consistent file upload/download behavior
 * - Allow entity-specific customization via callbacks
 * - Type-safe with TypeScript generics
 * - Portable - can be moved to shared monorepo package
 *
 * Usage Example:
 * ```typescript
 * const uploadHandler = createFileUploadHandler({
 *   entityName: 'receipt',
 *   filePrefix: 'receipt',
 *   getEntityById: receiptsAdapter.getReceiptById,
 *   getFileId: (receipt) => receipt.fileId,
 *   updateFileId: receiptsAdapter.updateReceiptFileId,
 *   onUploadSuccess: async (receipt, fileId, db) => {
 *     // Custom business logic after upload
 *   }
 * })
 *
 * router.post('/receipts/:id/upload', upload.single('file'), uploadHandler(db))
 * ```
 */

/**
 * Configuration for file upload/download routes
 * @template TEntity - The entity type (Receipt, KeySystem, etc.)
 */
export interface FileUploadConfig<TEntity> {
  /**
   * Fetch entity by ID
   * @param id - Entity ID (usually UUID)
   * @param db - Database connection
   * @returns Entity or undefined if not found
   */
  getEntityById: (id: string, db: Knex) => Promise<TEntity | undefined>

  /**
   * Extract fileId from entity
   * @param entity - The entity instance
   * @returns fileId or null/undefined if no file attached
   */
  getFileId: (entity: TEntity) => string | null | undefined

  /**
   * Update entity's fileId after successful upload
   * @param id - Entity ID
   * @param fileId - MinIO file ID
   * @param db - Database connection
   */
  updateFileId: (id: string, fileId: string, db: Knex) => Promise<void>

  /**
   * Clear entity's fileId (for delete operations)
   * @param id - Entity ID
   * @param db - Database connection
   */
  clearFileId?: (id: string, db: Knex) => Promise<void>

  /**
   * Human-readable entity name for error messages
   * @example "receipt", "key system"
   */
  entityName: string

  /**
   * Prefix for generated filenames in MinIO
   * @example "receipt" -> "receipt-{id}-{timestamp}.pdf"
   * @example "schema" -> "schema-{id}-{timestamp}.pdf"
   */
  filePrefix: string

  /**
   * Generate MinIO metadata tags for the uploaded file
   * @param entity - The entity instance
   * @param entityId - Entity ID
   * @returns Key-value metadata object
   */
  getFileMetadata?: (entity: TEntity, entityId: string) => Record<string, string>

  /**
   * Hook called after successful file upload and fileId update
   * Use for entity-specific business logic (e.g., activate loan, send notification)
   * @param entity - The entity instance
   * @param fileId - The uploaded file ID
   * @param db - Database connection
   */
  onUploadSuccess?: (entity: TEntity, fileId: string, db: Knex) => Promise<void>

  /**
   * Presigned URL expiry in seconds
   * @default 3600 (1 hour)
   */
  downloadUrlExpirySeconds?: number
}

/**
 * Schema for validating UUID path parameters
 */
const IdParamSchema = z.object({ id: z.string().uuid() })

/**
 * Creates a Koa middleware handler for file uploads via multipart/form-data
 *
 * This handler should be used with multer middleware:
 * ```typescript
 * router.post('/entity/:id/upload', upload.single('file'), uploadHandler(db))
 * ```
 *
 * Flow:
 * 1. Validate entity ID (UUID)
 * 2. Check entity exists
 * 3. Validate file was provided
 * 4. Delete old file if exists (prevents orphaned files)
 * 5. Upload new file to MinIO
 * 6. Update entity's fileId in database
 * 7. Execute onUploadSuccess hook if provided
 * 8. Return success response
 *
 * @template TEntity - The entity type
 * @param config - Upload configuration
 * @returns Koa middleware function factory that accepts database connection
 */
export function createFileUploadHandler<TEntity>(
  config: FileUploadConfig<TEntity>
) {
  return (db: Knex) => async (ctx: Context, _next: Next) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      // Validate entity ID
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: `Invalid ${config.entityName} id`, ...metadata }
        return
      }

      const entityId = parse.data.id

      // Check entity exists
      const entity = await config.getEntityById(entityId, db)
      if (!entity) {
        ctx.status = 404
        ctx.body = { reason: `${capitalize(config.entityName)} not found`, ...metadata }
        return
      }

      // Validate file was provided (multer attaches file to ctx)
      if (!ctx.file || !ctx.file.buffer) {
        ctx.status = 400
        ctx.body = { reason: 'No file provided', ...metadata }
        return
      }

      // Delete old file if exists (prevent orphaned files in MinIO)
      const existingFileId = config.getFileId(entity)
      if (existingFileId) {
        try {
          await deleteFile(existingFileId)
          logger.info(
            { fileId: existingFileId, entityId },
            `Old ${config.filePrefix} file deleted`
          )
        } catch (err) {
          logger.warn(
            { err, fileId: existingFileId, entityId },
            `Failed to delete old ${config.filePrefix} file`
          )
        }
      }

      // Generate unique filename
      const fileName = `${config.filePrefix}-${entityId}-${Date.now()}.pdf`

      // Get custom metadata if provided
      const fileMetadata = config.getFileMetadata
        ? config.getFileMetadata(entity, entityId)
        : {}

      // Upload to MinIO
      const fileId = await uploadFile(ctx.file.buffer, fileName, fileMetadata)

      // Update entity's fileId
      await config.updateFileId(entityId, fileId, db)

      // Execute post-upload hook (e.g., activate loan, send notification)
      if (config.onUploadSuccess) {
        await config.onUploadSuccess(entity, fileId, db)
      }

      ctx.status = 200
      ctx.body = {
        content: { fileId, fileName, size: ctx.file.size },
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, `Error uploading ${config.filePrefix} file`)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  }
}

/**
 * Creates a Koa middleware handler for generating presigned download URLs
 *
 * Flow:
 * 1. Validate entity ID
 * 2. Check entity exists
 * 3. Check entity has file attached
 * 4. Generate presigned URL with expiry
 * 5. Return URL and expiry info
 *
 * @template TEntity - The entity type
 * @param config - Download configuration
 * @returns Koa middleware function factory that accepts database connection
 */
export function createFileDownloadHandler<TEntity>(
  config: FileUploadConfig<TEntity>
) {
  return (db: Knex) => async (ctx: Context, _next: Next) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      // Validate entity ID
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: `Invalid ${config.entityName} id`, ...metadata }
        return
      }

      const entityId = parse.data.id

      // Check entity exists
      const entity = await config.getEntityById(entityId, db)
      if (!entity) {
        ctx.status = 404
        ctx.body = { reason: `${capitalize(config.entityName)} not found`, ...metadata }
        return
      }

      // Check file exists
      const fileId = config.getFileId(entity)
      if (!fileId) {
        ctx.status = 404
        ctx.body = {
          reason: `No file attached to this ${config.entityName}`,
          ...metadata,
        }
        return
      }

      // Generate presigned URL
      const expirySeconds = config.downloadUrlExpirySeconds || 60 * 60 // Default: 1 hour
      const url = await getFileUrl(fileId, expirySeconds)

      ctx.status = 200
      ctx.body = {
        content: { url, expiresIn: expirySeconds, fileId },
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, `Error generating ${config.filePrefix} download URL`)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  }
}

/**
 * Creates a Koa middleware handler for deleting files
 *
 * Flow:
 * 1. Validate entity ID
 * 2. Check entity exists
 * 3. Delete file from MinIO if exists
 * 4. Clear entity's fileId in database
 * 5. Return 204 No Content
 *
 * @template TEntity - The entity type
 * @param config - Delete configuration
 * @returns Koa middleware function factory that accepts database connection
 */
export function createFileDeleteHandler<TEntity>(
  config: FileUploadConfig<TEntity>
) {
  return (db: Knex) => async (ctx: Context, _next: Next) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      // Validate entity ID
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: `Invalid ${config.entityName} id`, ...metadata }
        return
      }

      const entityId = parse.data.id

      // Check entity exists
      const entity = await config.getEntityById(entityId, db)
      if (!entity) {
        ctx.status = 404
        ctx.body = { reason: `${capitalize(config.entityName)} not found`, ...metadata }
        return
      }

      // Delete file from MinIO if exists
      const fileId = config.getFileId(entity)
      if (fileId) {
        try {
          await deleteFile(fileId)
          logger.info(
            { fileId, entityId },
            `${capitalize(config.filePrefix)} file deleted from MinIO`
          )
        } catch (err) {
          logger.warn(
            { err, fileId, entityId },
            `Failed to delete ${config.filePrefix} file from MinIO`
          )
        }
      }

      // Clear fileId from database
      if (config.clearFileId) {
        await config.clearFileId(entityId, db)
      }

      ctx.status = 204
    } catch (err) {
      logger.error({ err }, `Error deleting ${config.filePrefix} file`)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  }
}

/**
 * Capitalize first letter of string
 * @param str - Input string
 * @returns Capitalized string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
