/**
 * File storage types shared between core and file-storage service
 */

/**
 * Basic file info returned by /files endpoint (list files)
 */
export interface FileListItem {
  name: string
  lastModified: string
  etag: string
  size: number
}

/**
 * Full file metadata returned by /files/{fileName}/metadata endpoint
 * Extends FileListItem with additional custom metadata
 */
export interface FileMetadata extends FileListItem {
  metaData?: Record<string, string>
}

/**
 * Response from file upload endpoint
 */
export interface FileUploadResponse {
  fileName: string
  message: string
}

/**
 * Response from get file URL endpoint
 */
export interface FileUrlResponse {
  url: string
  expiresIn: number
}

/**
 * Response from file exists endpoint
 */
export interface FileExistsResponse {
  exists: boolean
}

/**
 * Response from list files endpoint
 */
export interface ListFilesResponse {
  files: FileListItem[]
}
