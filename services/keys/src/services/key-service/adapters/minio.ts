import * as Minio from 'minio'
import Config from '../../../common/config'
import { logger } from '@onecore/utilities'
import { Readable } from 'stream'

// Log MinIO configuration for debugging
logger.info(
  {
    endPoint: Config.minio.endpoint,
    port: Config.minio.port,
    useSSL: Config.minio.useSsl,
    bucketName: Config.minio.bucketName,
  },
  'MinIO configuration'
)

// Initialize MinIO client with explicit useSSL boolean
export const minioClient = new Minio.Client({
  endPoint: Config.minio.endpoint,
  port: Config.minio.port,
  useSSL: Config.minio.useSsl,
  accessKey: Config.minio.accessKey,
  secretKey: Config.minio.secretKey,
})

const BUCKET_NAME = Config.minio.bucketName

/**
 * Ensure the receipts bucket exists, create if it doesn't
 */
export async function ensureBucketExists(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME)
    if (exists) {
      logger.info({ bucket: BUCKET_NAME }, 'MinIO bucket already exists')
    } else {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1')
      logger.info({ bucket: BUCKET_NAME }, 'MinIO bucket created successfully')
    }
  } catch (error) {
    logger.error(
      { error, bucket: BUCKET_NAME },
      'Failed to ensure bucket exists'
    )
    throw error
  }
}

/**
 * Upload a file to MinIO
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file (should be unique, e.g., UUID-based)
 * @param metadata - Optional metadata for the file
 * @returns The fileId (object key) stored in MinIO
 */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    const metaData = {
      'Content-Type': 'application/pdf',
      ...metadata,
    }

    await minioClient.putObject(
      BUCKET_NAME,
      fileName,
      fileBuffer,
      fileBuffer.length,
      metaData
    )

    logger.info({ fileName, bucket: BUCKET_NAME }, 'File uploaded successfully')
    return fileName
  } catch (error) {
    logger.error({ error, fileName }, 'Failed to upload file')
    throw error
  }
}

/**
 * Get a file from MinIO as a stream
 * @param fileId - The file ID (object key) to retrieve
 * @returns Readable stream of the file
 */
export async function getFile(fileId: string): Promise<Readable> {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, fileId)
    logger.info({ fileId, bucket: BUCKET_NAME }, 'File retrieved successfully')
    return stream
  } catch (error) {
    logger.error({ error, fileId }, 'Failed to get file')
    throw error
  }
}

/**
 * Generate a presigned URL for file download
 * @param fileId - The file ID (object key)
 * @param expirySeconds - URL expiry time in seconds (default: 7 days)
 * @returns Presigned URL for downloading the file
 */
export async function getFileUrl(
  fileId: string,
  expirySeconds = 7 * 24 * 60 * 60
): Promise<string> {
  try {
    const url = await minioClient.presignedGetObject(
      BUCKET_NAME,
      fileId,
      expirySeconds
    )
    logger.info(
      { fileId, expirySeconds, bucket: BUCKET_NAME },
      'Presigned URL generated'
    )
    return url
  } catch (error) {
    logger.error({ error, fileId }, 'Failed to generate presigned URL')
    throw error
  }
}

/**
 * Delete a file from MinIO
 * @param fileId - The file ID (object key) to delete
 */
export async function deleteFile(fileId: string): Promise<void> {
  try {
    await minioClient.removeObject(BUCKET_NAME, fileId)
    logger.info({ fileId, bucket: BUCKET_NAME }, 'File deleted successfully')
  } catch (error) {
    logger.error({ error, fileId }, 'Failed to delete file')
    throw error
  }
}

/**
 * Get file metadata (stats)
 * @param fileId - The file ID (object key)
 * @returns File metadata including size, etag, last modified, etc.
 */
export async function getFileMetadata(
  fileId: string
): Promise<Minio.BucketItemStat> {
  try {
    const stat = await minioClient.statObject(BUCKET_NAME, fileId)
    logger.info({ fileId, bucket: BUCKET_NAME }, 'File metadata retrieved')
    return stat
  } catch (error) {
    logger.error({ error, fileId }, 'Failed to get file metadata')
    throw error
  }
}

/**
 * Check if a file exists in MinIO
 * @param fileId - The file ID (object key)
 * @returns true if file exists, false otherwise
 */
export async function fileExists(fileId: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET_NAME, fileId)
    return true
  } catch (_error) {
    return false
  }
}
