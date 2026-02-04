import { loggedAxios as axios, logger } from '@onecore/utilities'
import { AxiosError } from 'axios'
import { keys } from '@onecore/types'
import Config from '../../common/config'
import { AdapterResult } from '../types'
import * as fileStorageAdapter from '../file-storage-adapter'

// ---- Import types from @onecore/types ---------------------------------------
type Key = keys.v1.Key
type KeyDetails = keys.v1.KeyDetails
type KeyLoan = keys.v1.KeyLoan
type KeyLoanWithDetails = keys.v1.KeyLoanWithDetails
type KeySystem = keys.v1.KeySystem
type Log = keys.v1.Log
type CreateLogRequest = keys.v1.CreateLogRequest
type KeyNote = keys.v1.KeyNote
type Receipt = keys.v1.Receipt
type CreateReceiptRequest = keys.v1.CreateReceiptRequest
type KeyEvent = keys.v1.KeyEvent
type CreateKeyEventRequest = keys.v1.CreateKeyEventRequest
type UpdateKeyEventRequest = keys.v1.UpdateKeyEventRequest
type Signature = keys.v1.Signature
type SendSignatureRequest = keys.v1.SendSignatureRequest
type PaginatedResponse<T> = keys.v1.PaginatedResponse<T>
type KeyBundle = keys.v1.KeyBundle
type KeyBundleDetailsResponse = keys.v1.KeyBundleDetailsResponse
type BundleWithLoanedKeysInfo = keys.v1.BundleWithLoanedKeysInfo
type CardOwner = keys.v1.CardOwner
type Card = keys.v1.Card
type CardDetails = keys.v1.CardDetails
type QueryCardOwnersParams = keys.v1.QueryCardOwnersParams

const BASE = Config.keysService.url

/**
 * ---- Shared helpers ---------------------------------------------------------
 */

type CommonErr =
  | 'bad-request'
  | 'not-found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'unknown'

function mapAxiosError(e: unknown): CommonErr {
  const err = e as AxiosError
  const status = err.response?.status
  if (status === 400) return 'bad-request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  return 'unknown'
}

function ok<T>(data: T): AdapterResult<T, never> {
  return { ok: true, data }
}

function fail<E extends CommonErr>(err: E): AdapterResult<never, E> {
  return { ok: false, err }
}

/**
 * ---- HTTP wrapper -----------------------------------------------------------
 */

async function getJSON<T>(
  url: string,
  headers?: Record<string, string>
): Promise<AdapterResult<T, CommonErr>> {
  try {
    const res = await axios.get<T>(url, { headers })
    return ok(res.data)
  } catch (e) {
    const err = mapAxiosError(e)
    logger.error({ err: e }, `GET ${url} failed -> ${err}`)
    return fail(err)
  }
}

async function postJSON<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<AdapterResult<T, CommonErr>> {
  try {
    const res = await axios.post<T>(url, body, { headers })
    if (res.status >= 400) {
      const err = mapAxiosError({ response: res } as AxiosError)
      logger.error(
        { status: res.status, body },
        `POST ${url} returned error -> ${err}`
      )
      return fail(err)
    }
    return ok(res.data)
  } catch (e) {
    const err = mapAxiosError(e)
    logger.error({ err: e, body }, `POST ${url} failed -> ${err}`)
    return fail(err)
  }
}

async function patchJSON<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<AdapterResult<T, CommonErr>> {
  try {
    const res = await axios.patch<T>(url, body, { headers })
    if (res.status >= 400) {
      const err = mapAxiosError({ response: res } as AxiosError)
      logger.error(
        { status: res.status, body },
        `PATCH ${url} returned error -> ${err}`
      )
      return fail(err)
    }
    return ok(res.data)
  } catch (e) {
    const err = mapAxiosError(e)
    logger.error({ err: e, body }, `PATCH ${url} failed -> ${err}`)
    return fail(err)
  }
}

async function deleteJSON<T = unknown>(
  url: string,
  headers?: Record<string, string>
): Promise<AdapterResult<T, CommonErr>> {
  try {
    const res = await axios.delete<T>(url, { headers })
    return ok(res.data)
  } catch (e) {
    const err = mapAxiosError(e)
    logger.error({ err: e }, `DELETE ${url} failed -> ${err}`)
    return fail(err)
  }
}

/**
 * ---- KEYS -------------------------------------------------------------------
 */

export const KeysApi = {
  list: async (
    page?: number,
    limit?: number,
    includeKeySystem?: boolean
  ): Promise<AdapterResult<PaginatedResponse<Key>, CommonErr>> => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())
    if (includeKeySystem) params.append('includeKeySystem', 'true')

    const queryString = params.toString()
    const url = queryString ? `${BASE}/keys?${queryString}` : `${BASE}/keys`

    const r = await getJSON<PaginatedResponse<Key>>(url)
    return r.ok ? ok(r.data) : r
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<Key>, 'bad-request' | CommonErr>
  > => {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v))
        } else {
          params.append(key, value)
        }
      }
    }

    // Note: includeKeySystem is already in searchParams from ctx.query
    // so we don't need to add it again here

    const r = await getJSON<PaginatedResponse<Key>>(
      `${BASE}/keys/search?${params.toString()}`
    )
    return r.ok ? ok(r.data) : r
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string,
    options?: {
      includeLoans?: boolean
      includeEvents?: boolean
      includeKeySystem?: boolean
    }
  ): Promise<AdapterResult<KeyDetails[], CommonErr>> => {
    const params = new URLSearchParams()
    if (options?.includeLoans) params.append('includeLoans', 'true')
    if (options?.includeEvents) params.append('includeEvents', 'true')
    if (options?.includeKeySystem) params.append('includeKeySystem', 'true')

    const queryString = params.toString()
    const queryParams = queryString ? `?${queryString}` : ''

    const r = await getJSON<{ content: KeyDetails[] }>(
      `${BASE}/keys/by-rental-object/${rentalObjectCode}${queryParams}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Key, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Key }>(`${BASE}/keys/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: Partial<Key>
  ): Promise<AdapterResult<Key, 'bad-request' | CommonErr>> => {
    const r = await postJSON<{ content: Key }>(`${BASE}/keys`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<Key>
  ): Promise<AdapterResult<Key, 'not-found' | 'bad-request' | CommonErr>> => {
    const r = await patchJSON<{ content: Key }>(`${BASE}/keys/${id}`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/keys/${id}`)
  },

  bulkUpdateFlex: async (
    rentalObjectCode: string,
    flexNumber: number
  ): Promise<
    AdapterResult<{ updatedCount: number }, 'bad-request' | CommonErr>
  > => {
    const r = await postJSON<{ content: { updatedCount: number } }>(
      `${BASE}/keys/bulk-update-flex`,
      { rentalObjectCode, flexNumber }
    )
    return r.ok ? ok(r.data.content) : r
  },
}

/**
 * ---- KEY LOANS --------------------------------------------------------------
 */

export const KeyLoansApi = {
  list: async (): Promise<AdapterResult<KeyLoan[], CommonErr>> => {
    const r = await getJSON<{ content: KeyLoan[] }>(`${BASE}/key-loans`)
    return r.ok ? ok(r.data.content) : r
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<KeyLoan>, 'bad-request' | CommonErr>
  > => {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v))
        } else {
          params.append(key, value)
        }
      }
    }

    const r = await getJSON<PaginatedResponse<KeyLoan>>(
      `${BASE}/key-loans/search?${params.toString()}`
    )
    return r.ok ? ok(r.data) : r
  },

  getByKey: async (
    keyId: string
  ): Promise<AdapterResult<KeyLoan[], CommonErr>> => {
    const r = await getJSON<{ content: KeyLoan[] }>(
      `${BASE}/key-loans/by-key/${keyId}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  getByCard: async (
    cardId: string
  ): Promise<AdapterResult<KeyLoan[], CommonErr>> => {
    const r = await getJSON<{ content: KeyLoan[] }>(
      `${BASE}/key-loans/by-card/${cardId}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  getByRentalObject: async (
    rentalObjectCode: string,
    contact?: string,
    contact2?: string,
    includeReceipts?: boolean,
    returned?: boolean
  ): Promise<AdapterResult<KeyLoanWithDetails[], CommonErr>> => {
    const params = new URLSearchParams()
    if (contact) params.append('contact', contact)
    if (contact2) params.append('contact2', contact2)
    if (includeReceipts) params.append('includeReceipts', 'true')
    if (returned !== undefined) params.append('returned', returned.toString())

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/key-loans/by-rental-object/${rentalObjectCode}?${queryString}`
      : `${BASE}/key-loans/by-rental-object/${rentalObjectCode}`

    const r = await getJSON<{ content: KeyLoanWithDetails[] }>(url)
    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeyLoan, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: KeyLoan }>(`${BASE}/key-loans/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: Partial<KeyLoan>
  ): Promise<
    AdapterResult<KeyLoan, 'bad-request' | 'conflict' | CommonErr>
  > => {
    const r = await postJSON<{ content: KeyLoan }>(`${BASE}/key-loans`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<KeyLoan>
  ): Promise<
    AdapterResult<KeyLoan, 'not-found' | 'bad-request' | 'conflict' | CommonErr>
  > => {
    const r = await patchJSON<{ content: KeyLoan }>(
      `${BASE}/key-loans/${id}`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/key-loans/${id}`)
  },

  getByContactWithKeys: async (
    contact: string,
    loanType?: 'TENANT' | 'MAINTENANCE',
    returned?: boolean
  ): Promise<AdapterResult<KeyLoanWithDetails[], CommonErr>> => {
    const params = new URLSearchParams()
    if (loanType) params.append('loanType', loanType)
    if (returned !== undefined) params.append('returned', returned.toString())

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/key-loans/by-contact/${contact}/with-keys?${queryString}`
      : `${BASE}/key-loans/by-contact/${contact}/with-keys`

    const r = await getJSON<{ content: KeyLoanWithDetails[] }>(url)
    return r.ok ? ok(r.data.content) : r
  },

  getByBundleWithKeys: async (
    bundleId: string,
    loanType?: 'TENANT' | 'MAINTENANCE',
    returned?: boolean
  ): Promise<AdapterResult<KeyLoanWithDetails[], CommonErr>> => {
    const params = new URLSearchParams()
    if (loanType) params.append('loanType', loanType)
    if (returned !== undefined) params.append('returned', returned.toString())

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/key-loans/by-bundle/${bundleId}/with-keys?${queryString}`
      : `${BASE}/key-loans/by-bundle/${bundleId}/with-keys`

    const r = await getJSON<{ content: KeyLoanWithDetails[] }>(url)
    return r.ok ? ok(r.data.content) : r
  },

  /**
   * Activate a key loan by setting pickedUpAt and completing incomplete key events.
   * This is called when a LOAN receipt file is uploaded.
   */
  activate: async (
    id: string
  ): Promise<
    AdapterResult<
      { activated: boolean; keyEventsCompleted: number },
      'not-found' | CommonErr
    >
  > => {
    const r = await postJSON<{
      activated: boolean
      keyEventsCompleted: number
    }>(`${BASE}/key-loans/${id}/activate`, {})
    return r.ok ? ok(r.data) : r
  },
}

/**
 * ---- KEY SYSTEMS ------------------------------------------------------------
 */

export const KeySystemsApi = {
  list: async (
    page?: number,
    limit?: number
  ): Promise<AdapterResult<PaginatedResponse<KeySystem>, CommonErr>> => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/key-systems?${queryString}`
      : `${BASE}/key-systems`

    const r = await getJSON<PaginatedResponse<KeySystem>>(url)
    return r.ok ? ok(r.data) : r
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<KeySystem>, 'bad-request' | CommonErr>
  > => {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v))
        } else {
          params.append(key, value)
        }
      }
    }

    const r = await getJSON<PaginatedResponse<KeySystem>>(
      `${BASE}/key-systems/search?${params.toString()}`
    )
    return r.ok ? ok(r.data) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeySystem, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: KeySystem }>(`${BASE}/key-systems/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: Partial<KeySystem>
  ): Promise<
    AdapterResult<KeySystem, 'bad-request' | 'conflict' | CommonErr>
  > => {
    const r = await postJSON<{ content: KeySystem }>(
      `${BASE}/key-systems`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<KeySystem>
  ): Promise<
    AdapterResult<
      KeySystem,
      'not-found' | 'bad-request' | 'conflict' | CommonErr
    >
  > => {
    const r = await patchJSON<{ content: KeySystem }>(
      `${BASE}/key-systems/${id}`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/key-systems/${id}`)
  },

  uploadSchemaFile: async (
    id: string,
    fileData: string,
    fileContentType?: string,
    options?: {
      userName?: string
      originalFileName?: string
    }
  ): Promise<AdapterResult<{ fileId: string }, 'not-found' | CommonErr>> => {
    // 1. Verify key system exists
    const keySystem = await KeySystemsApi.get(id)
    if (!keySystem.ok) {
      return fail(keySystem.err === 'not-found' ? 'not-found' : 'unknown')
    }

    // 2. Delete old file if exists (prevent orphans)
    if (keySystem.data.schemaFileId) {
      await fileStorageAdapter.deleteFile(keySystem.data.schemaFileId)
      logger.info(
        { oldFileId: keySystem.data.schemaFileId, keySystemId: id },
        'Deleted old schema file before uploading new one'
      )
    }

    // 3. Upload new file to file-storage
    const fileName = `keys/schema-${id}-${Date.now()}.pdf`
    const fileBuffer = Buffer.from(fileData, 'base64')
    const uploadResult = await fileStorageAdapter.uploadFile(
      fileName,
      fileBuffer,
      fileContentType || 'application/pdf'
    )
    if (!uploadResult.ok) {
      logger.error(
        { err: uploadResult.err, keySystemId: id },
        'Failed to upload schema file to file-storage'
      )
      return fail('unknown')
    }
    const fileId = uploadResult.data.fileName

    // 4. Update key-system with schemaFileId
    const updateResult = await KeySystemsApi.update(id, {
      schemaFileId: fileId,
    })
    if (!updateResult.ok) {
      // Compensation: delete uploaded file if update fails
      logger.info(
        { fileId, keySystemId: id },
        'Key system update failed, deleting uploaded file (compensation)'
      )
      await fileStorageAdapter.deleteFile(fileId)
      return fail('unknown')
    }

    // 5. Create log entry after successful schema upload
    const fileSizeKB = (fileBuffer.length / 1024).toFixed(2)
    try {
      await LogsApi.create({
        userName: options?.userName || 'system',
        eventType: 'update',
        objectType: 'keySystem',
        objectId: id,
        description: `Laddade upp lås-schema: ${options?.originalFileName || 'schema.pdf'} (${fileSizeKB} KB) för ${keySystem.data.systemCode}`,
      })
    } catch (error) {
      logger.error(
        {
          error,
          eventType: 'update',
          objectType: 'keySystem',
          objectId: id,
        },
        'Failed to create log entry for schema upload'
      )
      // Don't fail the operation if logging fails - file was uploaded successfully
    }

    return ok({ fileId })
  },

  getSchemaDownloadUrl: async (
    id: string
  ): Promise<
    AdapterResult<
      { url: string; expiresIn: number; fileId: string },
      'not-found' | CommonErr
    >
  > => {
    // 1. Get key-system to find schemaFileId
    const keySystem = await KeySystemsApi.get(id)
    if (!keySystem.ok) {
      return fail(keySystem.err)
    }
    if (!keySystem.data.schemaFileId) {
      return fail('not-found')
    }

    // 2. Get presigned URL from file-storage (1 hour expiry)
    const urlResult = await fileStorageAdapter.getFileUrl(
      keySystem.data.schemaFileId,
      60 * 60 // 3600 seconds = 1 hour
    )
    if (!urlResult.ok) {
      logger.error(
        { err: urlResult.err, fileId: keySystem.data.schemaFileId },
        'Failed to get schema download URL from file-storage'
      )
      return fail('unknown')
    }

    return ok({
      url: urlResult.data.url,
      expiresIn: urlResult.data.expiresIn,
      fileId: keySystem.data.schemaFileId,
    })
  },

  deleteSchemaFile: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    // 1. Get key-system to find schemaFileId
    const keySystem = await KeySystemsApi.get(id)
    if (!keySystem.ok) {
      return fail(keySystem.err)
    }

    if (!keySystem.data.schemaFileId) {
      // No file reference to delete
      return ok(undefined)
    }

    // 2. Delete from file-storage
    const deleteResult = await fileStorageAdapter.deleteFile(
      keySystem.data.schemaFileId
    )

    // If file deletion fails for reasons other than "not found", keep DB reference
    if (!deleteResult.ok && deleteResult.err !== 'not_found') {
      logger.error(
        { err: deleteResult.err, fileId: keySystem.data.schemaFileId },
        'Failed to delete schema file from file-storage'
      )
      return fail('unknown')
    }

    // 3. Clear schemaFileId - either file was deleted or didn't exist (orphaned reference)
    const updateResult = await KeySystemsApi.update(id, {
      schemaFileId: null,
    })
    if (!updateResult.ok) {
      return fail(updateResult.err)
    }

    return ok(undefined)
  },
}

/**
 * ---- LOGS -------------------------------------------------------------------
 */

export const LogsApi = {
  list: async (
    page?: number,
    limit?: number
  ): Promise<AdapterResult<PaginatedResponse<Log>, CommonErr>> => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())

    const queryString = params.toString()
    const url = queryString ? `${BASE}/logs?${queryString}` : `${BASE}/logs`

    const r = await getJSON<PaginatedResponse<Log>>(url)
    return r.ok ? ok(r.data) : r
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<Log>, 'bad-request' | CommonErr>
  > => {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v))
        } else {
          params.append(key, value)
        }
      }
    }

    const r = await getJSON<PaginatedResponse<Log>>(
      `${BASE}/logs/search?${params.toString()}`
    )
    return r.ok ? ok(r.data) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Log, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Log }>(`${BASE}/logs/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  getByObjectId: async (
    objectId: string
  ): Promise<AdapterResult<Log[], CommonErr>> => {
    const r = await getJSON<{ content: Log[] }>(
      `${BASE}/logs/object/${objectId}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: Partial<CreateLogRequest>
  ): Promise<AdapterResult<Log, 'bad-request' | CommonErr>> => {
    const r = await postJSON<{ content: Log }>(`${BASE}/logs`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string,
    page?: number,
    limit?: number,
    filters?: {
      eventType?: string
      objectType?: string
      userName?: string
    }
  ): Promise<AdapterResult<PaginatedResponse<Log>, CommonErr>> => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())
    if (filters?.eventType) params.append('eventType', filters.eventType)
    if (filters?.objectType) params.append('objectType', filters.objectType)
    if (filters?.userName) params.append('userName', filters.userName)

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/logs/rental-object/${encodeURIComponent(rentalObjectCode)}?${queryString}`
      : `${BASE}/logs/rental-object/${encodeURIComponent(rentalObjectCode)}`

    const r = await getJSON<PaginatedResponse<Log>>(url)
    return r.ok ? ok(r.data) : r
  },

  getByContactId: async (
    contactId: string,
    page?: number,
    limit?: number,
    filters?: {
      eventType?: string
      objectType?: string
      userName?: string
    }
  ): Promise<AdapterResult<PaginatedResponse<Log>, CommonErr>> => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())
    if (filters?.eventType) params.append('eventType', filters.eventType)
    if (filters?.objectType) params.append('objectType', filters.objectType)
    if (filters?.userName) params.append('userName', filters.userName)

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/logs/contact/${contactId}?${queryString}`
      : `${BASE}/logs/contact/${contactId}`

    const r = await getJSON<PaginatedResponse<Log>>(url)
    return r.ok ? ok(r.data) : r
  },
}

/**
 * ---- RECEIPTS ---------------------------------------------------------------
 */

export const ReceiptsApi = {
  create: async (
    payload: CreateReceiptRequest & {
      fileData?: string
      fileContentType?: string
    }
  ): Promise<
    AdapterResult<Receipt, 'bad-request' | 'conflict' | CommonErr>
  > => {
    const { fileData, fileContentType, ...receiptPayload } = payload
    let fileId: string | undefined

    // 1. If file provided, upload first (more likely to fail)
    if (fileData) {
      const fileName = `keys/receipt-${Date.now()}.pdf`
      const fileBuffer = Buffer.from(fileData, 'base64')
      const uploadResult = await fileStorageAdapter.uploadFile(
        fileName,
        fileBuffer,
        fileContentType || 'application/pdf'
      )
      if (!uploadResult.ok) {
        logger.error(
          { err: uploadResult.err },
          'Failed to upload receipt file to file-storage'
        )
        return fail('unknown')
      }
      fileId = uploadResult.data.fileName
    }

    // 2. Create receipt with fileId (if file was uploaded)
    const r = await postJSON<{ content: Receipt }>(`${BASE}/receipts`, {
      ...receiptPayload,
      ...(fileId && { fileId }),
    })

    // 3. Compensation: if receipt creation fails, delete uploaded file
    if (!r.ok && fileId) {
      logger.info(
        { fileId },
        'Receipt creation failed, deleting uploaded file (compensation)'
      )
      await fileStorageAdapter.deleteFile(fileId)
    }

    // 4. If LOAN receipt with file, activate key loan (set pickedUpAt and complete key events)
    if (r.ok && fileId && receiptPayload.receiptType === 'LOAN') {
      const activateResult = await KeyLoansApi.activate(
        receiptPayload.keyLoanId
      )
      if (activateResult.ok && activateResult.data.activated) {
        logger.info(
          {
            keyLoanId: receiptPayload.keyLoanId,
            receiptId: r.data.content.id,
            keyEventsCompleted: activateResult.data.keyEventsCompleted,
          },
          'Key loan activated after LOAN receipt created with file'
        )
      }
    }

    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Receipt, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Receipt }>(`${BASE}/receipts/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  getByKeyLoan: async (
    keyLoanId: string
  ): Promise<AdapterResult<Receipt[], CommonErr>> => {
    const r = await getJSON<{ content: Receipt[] }>(
      `${BASE}/receipts/by-key-loan/${keyLoanId}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    // 1. Get receipt to find fileId (if any)
    const receipt = await ReceiptsApi.get(id)
    if (!receipt.ok) {
      // If not found, nothing to delete
      if (receipt.err === 'not-found') {
        return fail('not-found')
      }
      return fail('unknown')
    }

    // 2. Delete file from storage if exists (prevent orphans)
    if (receipt.data.fileId) {
      await fileStorageAdapter.deleteFile(receipt.data.fileId)
      logger.info(
        { fileId: receipt.data.fileId, receiptId: id },
        'Deleted receipt file before removing receipt'
      )
    }

    // 3. Delete receipt from database
    return deleteJSON(`${BASE}/receipts/${id}`)
  },

  update: async (
    id: string,
    payload: Partial<Receipt>
  ): Promise<
    AdapterResult<Receipt, 'not-found' | 'bad-request' | CommonErr>
  > => {
    const r = await patchJSON<{ content: Receipt }>(
      `${BASE}/receipts/${id}`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  uploadFile: async (
    receiptId: string,
    fileData: string,
    fileContentType?: string
  ): Promise<AdapterResult<{ fileId: string }, 'not-found' | CommonErr>> => {
    // 1. Get receipt to verify it exists
    const receipt = await ReceiptsApi.get(receiptId)
    if (!receipt.ok) {
      return fail(receipt.err === 'not-found' ? 'not-found' : 'unknown')
    }

    // 2. Delete old file if exists (prevent orphans)
    if (receipt.data.fileId) {
      await fileStorageAdapter.deleteFile(receipt.data.fileId)
      logger.info(
        { oldFileId: receipt.data.fileId, receiptId },
        'Deleted old receipt file before uploading new one'
      )
    }

    // 3. Upload new file to file-storage
    const fileName = `keys/receipt-${receiptId}-${Date.now()}.pdf`
    const fileBuffer = Buffer.from(fileData, 'base64')
    const uploadResult = await fileStorageAdapter.uploadFile(
      fileName,
      fileBuffer,
      fileContentType || 'application/pdf'
    )
    if (!uploadResult.ok) {
      logger.error(
        { err: uploadResult.err, receiptId },
        'Failed to upload receipt file to file-storage'
      )
      return fail('unknown')
    }
    const fileId = uploadResult.data.fileName

    // 4. Update receipt with fileId
    const updateResult = await ReceiptsApi.update(receiptId, { fileId })
    if (!updateResult.ok) {
      // Compensation: delete uploaded file if receipt update fails
      logger.info(
        { fileId, receiptId },
        'Receipt update failed, deleting uploaded file (compensation)'
      )
      await fileStorageAdapter.deleteFile(fileId)
      return fail('unknown')
    }

    // 5. If LOAN receipt, activate key loan (set pickedUpAt and complete key events)
    if (receipt.data.receiptType === 'LOAN') {
      const activateResult = await KeyLoansApi.activate(receipt.data.keyLoanId)
      if (activateResult.ok && activateResult.data.activated) {
        logger.info(
          {
            keyLoanId: receipt.data.keyLoanId,
            receiptId,
            keyEventsCompleted: activateResult.data.keyEventsCompleted,
          },
          'Key loan activated after file uploaded to LOAN receipt'
        )
      }
    }

    return ok({ fileId })
  },

  getDownloadUrl: async (
    receiptId: string
  ): Promise<
    AdapterResult<
      { url: string; expiresIn: number; fileId: string },
      'not-found' | CommonErr
    >
  > => {
    // 1. Get receipt to find fileId
    const receipt = await ReceiptsApi.get(receiptId)
    if (!receipt.ok) {
      return fail(receipt.err)
    }
    if (!receipt.data.fileId) {
      return fail('not-found')
    }

    // 2. Get presigned URL from file-storage (1 hour expiry)
    const urlResult = await fileStorageAdapter.getFileUrl(
      receipt.data.fileId,
      60 * 60 // 3600 seconds = 1 hour
    )
    if (!urlResult.ok) {
      logger.error(
        { err: urlResult.err, fileId: receipt.data.fileId },
        'Failed to get download URL from file-storage'
      )
      return fail('unknown')
    }

    return ok({
      url: urlResult.data.url,
      expiresIn: urlResult.data.expiresIn,
      fileId: receipt.data.fileId,
    })
  },
}

/**
 * ---- KEY EVENTS -------------------------------------------------------------
 */

export const KeyEventsApi = {
  list: async (): Promise<AdapterResult<KeyEvent[], CommonErr>> => {
    const r = await getJSON<{ content: KeyEvent[] }>(`${BASE}/key-events`)
    return r.ok ? ok(r.data.content) : r
  },

  getByKey: async (
    keyId: string,
    limit?: number
  ): Promise<AdapterResult<KeyEvent[], CommonErr>> => {
    const params = new URLSearchParams()
    if (limit) params.append('limit', limit.toString())

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/key-events/by-key/${keyId}?${queryString}`
      : `${BASE}/key-events/by-key/${keyId}`

    const r = await getJSON<{ content: KeyEvent[] }>(url)
    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeyEvent, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: KeyEvent }>(`${BASE}/key-events/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: CreateKeyEventRequest
  ): Promise<
    AdapterResult<KeyEvent, 'bad-request' | 'conflict' | CommonErr>
  > => {
    const r = await postJSON<{ content: KeyEvent }>(
      `${BASE}/key-events`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: UpdateKeyEventRequest
  ): Promise<
    AdapterResult<KeyEvent, 'not-found' | 'bad-request' | CommonErr>
  > => {
    const r = await patchJSON<{ content: KeyEvent }>(
      `${BASE}/key-events/${id}`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },
}

/**
 * ---- KEY NOTES --------------------------------------------------------------
 */

export const KeyNotesApi = {
  getByRentalObjectCode: async (
    rentalObjectCode: string
  ): Promise<AdapterResult<KeyNote[], CommonErr>> => {
    const r = await getJSON<{ content: KeyNote[] }>(
      `${BASE}/key-notes/by-rental-object/${rentalObjectCode}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeyNote, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: KeyNote }>(`${BASE}/key-notes/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: Partial<KeyNote>
  ): Promise<AdapterResult<KeyNote, 'bad-request' | CommonErr>> => {
    const r = await postJSON<{ content: KeyNote }>(`${BASE}/key-notes`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<KeyNote>
  ): Promise<
    AdapterResult<KeyNote, 'not-found' | 'bad-request' | CommonErr>
  > => {
    const r = await patchJSON<{ content: KeyNote }>(
      `${BASE}/key-notes/${id}`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },
}

/**
 * ---- Key Bundles API --------------------------------------------------------
 */

export const KeyBundlesApi = {
  list: async (
    page?: number,
    limit?: number
  ): Promise<AdapterResult<PaginatedResponse<KeyBundle>, CommonErr>> => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())

    const queryString = params.toString()
    const url = queryString
      ? `${BASE}/key-bundles?${queryString}`
      : `${BASE}/key-bundles`

    const r = await getJSON<PaginatedResponse<KeyBundle>>(url)
    return r.ok ? ok(r.data) : r
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<KeyBundle>, 'bad-request' | CommonErr>
  > => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v))
        } else {
          params.append(key, value)
        }
      }
    }
    const r = await getJSON<PaginatedResponse<KeyBundle>>(
      `${BASE}/key-bundles/search?${params.toString()}`
    )
    return r.ok ? ok(r.data) : r
  },

  getByKey: async (
    keyId: string
  ): Promise<AdapterResult<KeyBundle[], CommonErr>> => {
    const r = await getJSON<{ content: KeyBundle[] }>(
      `${BASE}/key-bundles/by-key/${keyId}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeyBundle, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: KeyBundle }>(`${BASE}/key-bundles/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: Partial<KeyBundle>
  ): Promise<
    AdapterResult<KeyBundle, 'bad-request' | 'conflict' | CommonErr>
  > => {
    const r = await postJSON<{ content: KeyBundle }>(
      `${BASE}/key-bundles`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<KeyBundle>
  ): Promise<
    AdapterResult<
      KeyBundle,
      'not-found' | 'bad-request' | 'conflict' | CommonErr
    >
  > => {
    const r = await patchJSON<{ content: KeyBundle }>(
      `${BASE}/key-bundles/${id}`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/key-bundles/${id}`)
  },

  getWithLoanStatus: async (
    id: string,
    options?: {
      includeLoans?: boolean
      includeEvents?: boolean
      includeKeySystem?: boolean
    }
  ): Promise<
    AdapterResult<KeyBundleDetailsResponse, 'not-found' | CommonErr>
  > => {
    const params = new URLSearchParams()
    if (options?.includeLoans) params.append('includeLoans', 'true')
    if (options?.includeEvents) params.append('includeEvents', 'true')
    if (options?.includeKeySystem) params.append('includeKeySystem', 'true')

    const queryString = params.toString()
    const queryParams = queryString ? `?${queryString}` : ''

    const r = await getJSON<{ content: KeyBundleDetailsResponse }>(
      `${BASE}/key-bundles/${id}/keys-with-loan-status${queryParams}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  getByContactWithLoanedKeys: async (
    contactCode: string
  ): Promise<AdapterResult<BundleWithLoanedKeysInfo[], CommonErr>> => {
    const r = await getJSON<{ content: BundleWithLoanedKeysInfo[] }>(
      `${BASE}/key-bundles/by-contact/${contactCode}/with-loaned-keys`
    )
    return r.ok ? ok(r.data.content) : r
  },
}

/**
 * ---- Signatures API --------------------------------------------------------
 */
export const SignaturesApi = {
  send: async (
    payload: SendSignatureRequest
  ): Promise<
    AdapterResult<Signature, 'bad-request' | 'not-found' | CommonErr>
  > => {
    const r = await postJSON<{ content: Signature }>(
      `${BASE}/signatures/send`,
      payload
    )
    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Signature, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Signature }>(`${BASE}/signatures/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  getByResource: async (
    resourceType: string,
    resourceId: string
  ): Promise<AdapterResult<Signature[], CommonErr>> => {
    const r = await getJSON<{ content: Signature[] }>(
      `${BASE}/signatures/resource/${resourceType}/${resourceId}`
    )
    return r.ok ? ok(r.data.content) : r
  },
}

/**
 * ---- DAX API ---------------------------------------------------------------
 */
export const DaxApi = {
  searchCardOwners: async (
    params: Partial<QueryCardOwnersParams>
  ): Promise<AdapterResult<CardOwner[], CommonErr>> => {
    const queryParams = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString())
      }
    }

    const query = queryParams.toString()
    const url = `${BASE}/dax/card-owners${query ? `?${query}` : ''}`

    const r = await getJSON<{ cardOwners: CardOwner[] }>(url)
    return r.ok ? ok(r.data.cardOwners) : r
  },

  getCardOwner: async (
    cardOwnerId: string,
    expand?: string
  ): Promise<AdapterResult<CardOwner, 'not-found' | CommonErr>> => {
    const params = new URLSearchParams()
    if (expand) params.append('expand', expand)

    const query = params.toString()
    const url = `${BASE}/dax/card-owners/${cardOwnerId}${query ? `?${query}` : ''}`

    const r = await getJSON<{ cardOwner: CardOwner }>(url)
    return r.ok ? ok(r.data.cardOwner) : r
  },

  getCard: async (
    cardId: string,
    expand?: string
  ): Promise<AdapterResult<Card, 'not-found' | CommonErr>> => {
    const params = new URLSearchParams()
    if (expand) params.append('expand', expand)

    const query = params.toString()
    const url = `${BASE}/dax/cards/${cardId}${query ? `?${query}` : ''}`

    const r = await getJSON<{ card: Card }>(url)
    return r.ok ? ok(r.data.card) : r
  },
}

/**
 * ---- CARDS -----------------------------------------------------------------
 */
export const CardsApi = {
  getById: async (
    cardId: string
  ): Promise<AdapterResult<Card, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Card }>(`${BASE}/cards/${cardId}`)
    return r.ok ? ok(r.data.content) : r
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string,
    options?: {
      includeLoans?: boolean
    }
  ): Promise<AdapterResult<CardDetails[], CommonErr>> => {
    const params = new URLSearchParams()
    if (options?.includeLoans) params.append('includeLoans', 'true')

    const queryString = params.toString()
    const queryParams = queryString ? `?${queryString}` : ''

    const r = await getJSON<{ content: CardDetails[] }>(
      `${BASE}/cards/by-rental-object/${rentalObjectCode}${queryParams}`
    )
    return r.ok ? ok(r.data.content) : r
  },
}
