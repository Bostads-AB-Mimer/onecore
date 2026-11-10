import { Readable } from 'stream'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { logger } from '@onecore/utilities'
import s3Config from '../config/s3'

/**
 * A stored object as returned by listFiles.
 * Shape matches FileListItemSchema in @onecore/types (the API contract).
 */
export interface StoredFile {
  name: string
  size: number
  etag: string
  lastModified: Date
}

/**
 * A stored object's metadata as returned by getFileMetadata.
 * Shape matches FileMetadataSchema in @onecore/types (the API contract).
 */
export interface StoredFileMetadata extends StoredFile {
  metaData: Record<string, string>
}

export const s3Client = new S3Client({
  endpoint: `${s3Config.useSSL ? 'https' : 'http'}://${s3Config.endpoint}:${s3Config.port}`,
  // SeaweedFS/MinIO ignore the region, but the SDK requires one for request signing
  region: 'us-east-1',
  // Self-hosted S3 serves buckets as a path (host/bucket), not as a subdomain
  forcePathStyle: true,
  credentials: {
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  },
})

const BUCKET_NAME = s3Config.bucketName

// S3 returns ETags wrapped in double quotes; the API contract has always exposed them unquoted
const stripEtagQuotes = (etag: string | undefined): string =>
  (etag ?? '').replace(/^"|"$/g, '')

const isNotFound = (err: unknown): boolean =>
  err instanceof S3ServiceException &&
  (err.name === 'NotFound' ||
    err.name === 'NoSuchKey' ||
    err.$metadata.httpStatusCode === 404)

const isBucketAlreadyExists = (err: unknown): boolean =>
  err instanceof S3ServiceException &&
  (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists')

/**
 * Ensure the bucket exists, create if it doesn't
 */
export const initializeBucket = async (): Promise<void> => {
  try {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }))
      logger.info({ bucket: BUCKET_NAME }, 'S3 bucket already exists')
    } catch (err) {
      if (!isNotFound(err)) throw err
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }))
        logger.info({ bucket: BUCKET_NAME }, 'S3 bucket created')
      } catch (createErr) {
        // Another replica won the race to create the bucket; that is a success for us
        if (!isBucketAlreadyExists(createErr)) throw createErr
        logger.info(
          { bucket: BUCKET_NAME },
          'S3 bucket created by another replica'
        )
      }
    }
  } catch (err) {
    logger.error({ err, bucket: BUCKET_NAME }, 's3Adapter.initializeBucket')
    throw err
  }
}

/**
 * Upload a file to object storage
 * @param fileName - The name of the file (should be unique, e.g., UUID-based)
 * @param fileBuffer - The file buffer to upload
 * @param contentType - MIME type of the file
 * @returns The fileName (object key) stored in the bucket
 */
export const uploadFile = async (
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> => {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      })
    )
    logger.info({ fileName, bucket: BUCKET_NAME }, 'File uploaded')
    return fileName
  } catch (err) {
    logger.error({ err, fileName }, 's3Adapter.uploadFile')
    throw err
  }
}

/**
 * Get a file from object storage as a stream
 * @param fileName - The file name (object key) to retrieve
 * @returns Readable stream of the file
 */
export const getFile = async (fileName: string): Promise<Readable> => {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileName })
    )
    // In Node.js the SDK returns the body as a Readable (IncomingMessage)
    if (!(result.Body instanceof Readable)) {
      throw new Error(`Unexpected body type for file '${fileName}'`)
    }
    logger.info({ fileName, bucket: BUCKET_NAME }, 'File retrieved')
    return result.Body
  } catch (err) {
    logger.error({ err, fileName }, 's3Adapter.getFile')
    throw err
  }
}

/**
 * Generate a presigned URL for file download
 * @param fileName - The file name (object key)
 * @param expirySeconds - URL expiry time in seconds (default: 1 hour)
 * @returns Presigned URL for downloading the file
 */
export const getFileUrl = async (
  fileName: string,
  expirySeconds: number = 3600
): Promise<string> => {
  try {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileName }),
      { expiresIn: expirySeconds }
    )
    logger.info({ fileName, expirySeconds }, 'Presigned URL generated')
    return url
  } catch (err) {
    logger.error({ err, fileName }, 's3Adapter.getFileUrl')
    throw err
  }
}

/**
 * Delete a file from object storage
 * @param fileName - The file name (object key) to delete
 */
export const deleteFile = async (fileName: string): Promise<void> => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: fileName })
    )
    logger.info({ fileName, bucket: BUCKET_NAME }, 'File deleted')
  } catch (err) {
    logger.error({ err, fileName }, 's3Adapter.deleteFile')
    throw err
  }
}

/**
 * Get file metadata (stats)
 * @param fileName - The file name (object key)
 * @returns File metadata including size, etag, last modified, etc.
 */
export const getFileMetadata = async (
  fileName: string
): Promise<StoredFileMetadata> => {
  try {
    const head = await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: fileName })
    )

    // Header-style keys ('content-type', 'x-amz-meta-*') are what core reads from metaData
    const metaData: Record<string, string> = {}
    if (head.ContentType) {
      metaData['content-type'] = head.ContentType
    }
    for (const [key, value] of Object.entries(head.Metadata ?? {})) {
      metaData[`x-amz-meta-${key}`] = value
    }

    return {
      name: fileName,
      size: head.ContentLength ?? 0,
      etag: stripEtagQuotes(head.ETag),
      lastModified: head.LastModified ?? new Date(0),
      metaData,
    }
  } catch (err) {
    logger.error({ err, fileName }, 's3Adapter.getFileMetadata')
    throw err
  }
}

/**
 * Check if a file exists in object storage
 * @param fileName - The file name (object key)
 * @returns true if file exists, false if it does not. Other errors are rethrown.
 */
export const fileExists = async (fileName: string): Promise<boolean> => {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: fileName })
    )
    return true
  } catch (err) {
    if (isNotFound(err)) return false
    logger.error({ err, fileName }, 's3Adapter.fileExists')
    throw err
  }
}

/**
 * List all files with a given prefix
 * @param prefix - The prefix to filter files (e.g., 'components/')
 * @returns Array of stored files
 */
export const listFiles = async (prefix: string): Promise<StoredFile[]> => {
  try {
    const files: StoredFile[] = []
    let continuationToken: string | undefined

    // S3 returns at most 1000 keys per request; follow continuation tokens to get all
    do {
      const page = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      )
      for (const obj of page.Contents ?? []) {
        if (!obj.Key) continue
        files.push({
          name: obj.Key,
          size: obj.Size ?? 0,
          etag: stripEtagQuotes(obj.ETag),
          lastModified: obj.LastModified ?? new Date(0),
        })
      }
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined
    } while (continuationToken)

    logger.info({ prefix, count: files.length }, 'Listed files')
    return files
  } catch (err) {
    logger.error({ err, prefix }, 's3Adapter.listFiles')
    throw err
  }
}
