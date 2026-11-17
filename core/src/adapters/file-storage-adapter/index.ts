import { logger, loggedAxios as axios } from '@onecore/utilities'
import type {
  FileListItem,
  FileMetadata,
  FileUploadResponse,
  FileUrlResponse,
} from '@onecore/types'

import { AdapterResult } from '../types'
import config from '../../common/config'

const isSuccessStatus = (status: number) => status >= 200 && status < 300

const errorSummary = (err: unknown) =>
  axios.isAxiosError(err)
    ? { status: err.response?.status, message: err.message }
    : { message: err instanceof Error ? err.message : String(err) }

export async function uploadFile(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<
  AdapterResult<
    FileUploadResponse,
    'unknown' | 'bad_request' | 'payload_too_large'
  >
> {
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
        validateStatus: isSuccessStatus,
      }
    )

    if (response.data) {
      return { ok: true, data: response.data }
    }

    logger.error({ fileName }, 'file-storage-adapter.uploadFile: empty body')
    return { ok: false, err: 'unknown' }
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    if (status === 400) {
      logger.warn({ fileName }, 'file-storage-adapter.uploadFile: bad request')
      return { ok: false, err: 'bad_request' }
    }
    if (status === 413) {
      logger.warn(
        { fileName },
        'file-storage-adapter.uploadFile: payload too large'
      )
      return { ok: false, err: 'payload_too_large' }
    }
    logger.error(
      { err: errorSummary(err), fileName },
      'file-storage-adapter.uploadFile'
    )
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
        validateStatus: isSuccessStatus,
      }
    )

    if (response.data?.url) {
      return { ok: true, data: response.data }
    }

    logger.error({ fileName }, 'file-storage-adapter.getFileUrl: no url')
    return { ok: false, err: 'unknown' }
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    if (status === 404) {
      logger.warn({ fileName }, 'file-storage-adapter.getFileUrl: not found')
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err: errorSummary(err), fileName },
      'file-storage-adapter.getFileUrl'
    )
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

export async function listFiles(
  prefix?: string
): Promise<AdapterResult<FileListItem[], 'unknown'>> {
  try {
    const response = await axios.get<{ files: FileListItem[] }>(
      `${config.fileStorageService.url}/files`,
      {
        params: prefix ? { prefix } : undefined,
      }
    )

    if (response.data?.files) {
      return { ok: true, data: response.data.files }
    }

    return { ok: false, err: 'unknown' }
  } catch (err: unknown) {
    logger.error({ err, prefix }, 'file-storage-adapter.listFiles')
    return { ok: false, err: 'unknown' }
  }
}
