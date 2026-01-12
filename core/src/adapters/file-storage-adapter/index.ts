import { logger, loggedAxios as axios } from '@onecore/utilities'

import { AdapterResult } from '../types'
import config from '../../common/config'

export interface FileUploadResponse {
  fileName: string
  message: string
}

export interface FileUrlResponse {
  url: string
  expiresIn: number
}

export interface FileMetadata {
  size: number
  etag: string
  lastModified: string
  metaData?: Record<string, string>
}

export async function uploadFile(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<AdapterResult<FileUploadResponse, 'unknown' | 'bad_request'>> {
  try {
    const fileData = fileBuffer.toString('base64')

    const response = await axios.post<FileUploadResponse>(
      `${config.fileStorageService.url}/files/upload`,
      {
        fileName,
        fileData,
        contentType,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.data) {
      return { ok: true, data: response.data }
    }

    return { ok: false, err: 'unknown' }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 400) {
      return { ok: false, err: 'bad_request' }
    }
    logger.error({ err, fileName }, 'file-storage-adapter.uploadFile')
    return { ok: false, err: 'unknown' }
  }
}

export async function getFileUrl(
  fileName: string,
  expirySeconds: number = 3600
): Promise<AdapterResult<FileUrlResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await axios.get<FileUrlResponse>(
      `${config.fileStorageService.url}/files/${encodeURIComponent(fileName)}/url`,
      {
        params: { expirySeconds },
      }
    )

    if (response.data) {
      return { ok: true, data: response.data }
    }

    return { ok: false, err: 'unknown' }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error({ err, fileName }, 'file-storage-adapter.getFileUrl')
    return { ok: false, err: 'unknown' }
  }
}

export async function getFileMetadata(
  fileName: string
): Promise<AdapterResult<FileMetadata, 'unknown' | 'not_found'>> {
  try {
    const response = await axios.get<FileMetadata>(
      `${config.fileStorageService.url}/files/${encodeURIComponent(fileName)}/metadata`
    )

    if (response.data) {
      return { ok: true, data: response.data }
    }

    return { ok: false, err: 'unknown' }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error({ err, fileName }, 'file-storage-adapter.getFileMetadata')
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteFile(
  fileName: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    await axios.delete(
      `${config.fileStorageService.url}/files/${encodeURIComponent(fileName)}`
    )

    return { ok: true, data: undefined }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error({ err, fileName }, 'file-storage-adapter.deleteFile')
    return { ok: false, err: 'unknown' }
  }
}

export async function fileExists(
  fileName: string
): Promise<AdapterResult<boolean, 'unknown'>> {
  try {
    const response = await axios.get<{ exists: boolean }>(
      `${config.fileStorageService.url}/files/${encodeURIComponent(fileName)}/exists`
    )

    return { ok: true, data: response.data.exists }
  } catch (err: unknown) {
    logger.error({ err, fileName }, 'file-storage-adapter.fileExists')
    return { ok: false, err: 'unknown' }
  }
}
