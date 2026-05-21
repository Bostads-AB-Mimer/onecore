import { Client, BucketItem } from 'minio'
import minioConfig from '../config/minio'

// Initialize MinIO client
export const minioClient = new Client({
  endPoint: minioConfig.endpoint,
  port: minioConfig.port,
  useSSL: minioConfig.useSSL,
  accessKey: minioConfig.accessKey,
  secretKey: minioConfig.secretKey,
})

const BUCKET_NAME = minioConfig.bucketName
const PUBLIC_BUCKET_NAME = minioConfig.publicBucketName

// Anonymous read policy applied to the public bucket — grants s3:GetObject to
// any principal so plain <img src=".../<bucket>/<key>"> works without auth.
// No list, write, or delete permissions are exposed anonymously.
const publicReadPolicy = (bucketName: string) => ({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${bucketName}/*`],
    },
  ],
})

/**
 * Ensure the bucket exists, create if it doesn't
 */
export const initializeBucket = async (): Promise<void> => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME)
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1')
      console.log(`MinIO bucket '${BUCKET_NAME}' created successfully`)
    } else {
      console.log(`MinIO bucket '${BUCKET_NAME}' already exists`)
    }
  } catch (error) {
    console.error(`Failed to ensure bucket '${BUCKET_NAME}' exists:`, error)
    throw error
  }
}

/**
 * Ensure the public bucket exists with an anonymous-read policy applied.
 * Policy is re-applied on every startup so dev environments stay consistent
 * even if someone has tweaked it via the MinIO console.
 */
export const initializePublicBucket = async (): Promise<void> => {
  try {
    const exists = await minioClient.bucketExists(PUBLIC_BUCKET_NAME)
    if (!exists) {
      await minioClient.makeBucket(PUBLIC_BUCKET_NAME, 'us-east-1')
      console.log(`MinIO bucket '${PUBLIC_BUCKET_NAME}' created successfully`)
    } else {
      console.log(`MinIO bucket '${PUBLIC_BUCKET_NAME}' already exists`)
    }

    await minioClient.setBucketPolicy(
      PUBLIC_BUCKET_NAME,
      JSON.stringify(publicReadPolicy(PUBLIC_BUCKET_NAME))
    )
    console.log(
      `MinIO bucket '${PUBLIC_BUCKET_NAME}' anonymous read policy applied`
    )
  } catch (error) {
    console.error(
      `Failed to ensure public bucket '${PUBLIC_BUCKET_NAME}' exists:`,
      error
    )
    throw error
  }
}

/**
 * Upload a file to MinIO
 * @param fileName - The name of the file (should be unique, e.g., UUID-based)
 * @param fileBuffer - The file buffer to upload
 * @param contentType - MIME type of the file
 * @returns The fileName (object key) stored in MinIO
 */
export const uploadFile = async (
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> => {
  try {
    const metadata = {
      'Content-Type': contentType,
    }

    await minioClient.putObject(
      BUCKET_NAME,
      fileName,
      fileBuffer,
      fileBuffer.length,
      metadata
    )

    console.log(
      `File '${fileName}' uploaded successfully to bucket '${BUCKET_NAME}'`
    )
    return fileName
  } catch (error) {
    console.error(`Failed to upload file '${fileName}':`, error)
    throw error
  }
}

/**
 * Get a file from MinIO as a stream
 * @param fileName - The file name (object key) to retrieve
 * @returns Readable stream of the file
 */
export const getFile = async (fileName: string) => {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, fileName)
    console.log(
      `File '${fileName}' retrieved successfully from bucket '${BUCKET_NAME}'`
    )
    return stream
  } catch (error) {
    console.error(`Failed to get file '${fileName}':`, error)
    throw error
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
    const url = await minioClient.presignedGetObject(
      BUCKET_NAME,
      fileName,
      expirySeconds
    )
    console.log(
      `Presigned URL generated for file '${fileName}' (expires in ${expirySeconds}s)`
    )
    return url
  } catch (error) {
    console.error(
      `Failed to generate presigned URL for file '${fileName}':`,
      error
    )
    throw error
  }
}

/**
 * Delete a file from MinIO
 * @param fileName - The file name (object key) to delete
 */
export const deleteFile = async (fileName: string): Promise<void> => {
  try {
    await minioClient.removeObject(BUCKET_NAME, fileName)
    console.log(
      `File '${fileName}' deleted successfully from bucket '${BUCKET_NAME}'`
    )
  } catch (error) {
    console.error(`Failed to delete file '${fileName}':`, error)
    throw error
  }
}

/**
 * Get file metadata (stats)
 * @param fileName - The file name (object key)
 * @returns File metadata including size, etag, last modified, etc.
 */
export const getFileMetadata = async (fileName: string) => {
  try {
    const stat = await minioClient.statObject(BUCKET_NAME, fileName)
    console.log(`File metadata retrieved for '${fileName}'`)
    return stat
  } catch (error) {
    console.error(`Failed to get file metadata for '${fileName}':`, error)
    throw error
  }
}

/**
 * Check if a file exists in MinIO
 * @param fileName - The file name (object key)
 * @returns true if file exists, false otherwise
 */
export const fileExists = async (fileName: string): Promise<boolean> => {
  try {
    await minioClient.statObject(BUCKET_NAME, fileName)
    return true
  } catch (_error) {
    return false
  }
}

/**
 * List files with a given prefix
 * @param prefix - The prefix to filter files (e.g., 'components/')
 * @returns Array of file names
 */
export const listFiles = async (prefix: string): Promise<BucketItem[]> => {
  try {
    const stream = minioClient.listObjectsV2(BUCKET_NAME, prefix, true)
    const files: BucketItem[] = []

    return new Promise<BucketItem[]>((resolve, reject) => {
      stream.on('data', (obj: BucketItem) => {
        if (obj) {
          files.push(obj)
        }
      })
      stream.on('end', () => {
        console.log(`Listed ${files.length} files with prefix '${prefix}'`)
        resolve(files)
      })
      stream.on('error', (error: Error) => {
        console.error(`Failed to list files with prefix '${prefix}':`, error)
        reject(error)
      })
    })
  } catch (error) {
    console.error(`Failed to list files with prefix '${prefix}':`, error)
    throw error
  }
}

/**
 * Upload a file to the public bucket with long-lived cache headers.
 * Objects in this bucket are world-readable via the bucket policy applied
 * in initializePublicBucket — do not put anything sensitive here.
 * @param key - The object key (path inside the public bucket)
 * @param fileBuffer - The file buffer to upload
 * @param contentType - MIME type of the file
 * @returns The key stored in MinIO
 */
export const uploadPublicFile = async (
  key: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> => {
  try {
    const metadata = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    }

    await minioClient.putObject(
      PUBLIC_BUCKET_NAME,
      key,
      fileBuffer,
      fileBuffer.length,
      metadata
    )

    console.log(
      `File '${key}' uploaded successfully to bucket '${PUBLIC_BUCKET_NAME}'`
    )
    return key
  } catch (error) {
    console.error(`Failed to upload public file '${key}':`, error)
    throw error
  }
}

/**
 * Check if an object exists in the public bucket.
 * @param key - The object key
 */
export const publicFileExists = async (key: string): Promise<boolean> => {
  try {
    await minioClient.statObject(PUBLIC_BUCKET_NAME, key)
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Build the anonymous-access URL for an object in the public bucket.
 * Omits the port when it matches the protocol default (80/443).
 * @param key - The object key (path inside the public bucket)
 */
export const getPublicFileUrl = (key: string): string => {
  const protocol = minioConfig.useSSL ? 'https' : 'http'
  const port = minioConfig.port
  const isDefaultPort =
    (minioConfig.useSSL && port === 443) || (!minioConfig.useSSL && port === 80)
  const host = isDefaultPort
    ? minioConfig.endpoint
    : `${minioConfig.endpoint}:${port}`
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${protocol}://${host}/${PUBLIC_BUCKET_NAME}/${encodedKey}`
}
