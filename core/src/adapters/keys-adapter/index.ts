import { loggedAxios as axios, logger } from '@onecore/utilities'
import { AxiosError } from 'axios'
import { keys } from '@onecore/types'
import Config from '../../common/config'
import { AdapterResult } from '../types'

// ---- Import types from @onecore/types ---------------------------------------
type Key = keys.v1.Key
type KeyWithLoanAndEvent = keys.v1.KeyWithLoanAndEvent
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
type KeyBundleWithLoanStatusResponse = keys.v1.KeyBundleWithLoanStatusResponse
type BundleWithLoanedKeysInfo = keys.v1.BundleWithLoanedKeysInfo

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
    limit?: number
  ): Promise<AdapterResult<PaginatedResponse<Key>, CommonErr>> => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())

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

    const r = await getJSON<PaginatedResponse<Key>>(
      `${BASE}/keys/search?${params.toString()}`
    )
    return r.ok ? ok(r.data) : r
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string
  ): Promise<AdapterResult<Key[], CommonErr>> => {
    const r = await getJSON<{ content: Key[] }>(
      `${BASE}/keys/by-rental-object/${rentalObjectCode}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  getWithLoanStatus: async (
    rentalObjectCode: string,
    includeLatestEvent?: boolean
  ): Promise<AdapterResult<KeyWithLoanAndEvent[], CommonErr>> => {
    const queryParams = includeLatestEvent ? '?includeLatestEvent=true' : ''
    const r = await getJSON<{ content: KeyWithLoanAndEvent[] }>(
      `${BASE}/keys/with-loan-status/${rentalObjectCode}${queryParams}`
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
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<
    AdapterResult<
      { fileId: string; fileName: string; size: number },
      'not-found' | 'bad-request' | CommonErr
    >
  > => {
    try {
      // Create FormData to forward to microservice
      const FormData = (await import('form-data')).default
      const formData = new FormData()
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
      })

      const res = await axios.post<{
        content: { fileId: string; fileName: string; size: number }
      }>(`${BASE}/key-systems/${id}/upload-schema`, formData as any, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })

      return ok(res.data.content)
    } catch (e) {
      const err = mapAxiosError(e)
      logger.error(
        {
          err: e,
          response: (e as AxiosError)?.response?.data,
        },
        `POST ${BASE}/key-systems/${id}/upload-schema failed -> ${err}`
      )
      return fail(err)
    }
  },

  getSchemaDownloadUrl: async (
    id: string
  ): Promise<
    AdapterResult<
      { url: string; expiresIn: number; fileId: string },
      'not-found' | CommonErr
    >
  > => {
    const r = await getJSON<{
      content: { url: string; expiresIn: number; fileId: string }
    }>(`${BASE}/key-systems/${id}/download-schema`)
    return r.ok ? ok(r.data.content) : r
  },

  deleteSchemaFile: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/key-systems/${id}/schema`)
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
    payload: CreateReceiptRequest
  ): Promise<
    AdapterResult<Receipt, 'bad-request' | 'conflict' | CommonErr>
  > => {
    const r = await postJSON<{ content: Receipt }>(`${BASE}/receipts`, payload)
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

  // <-- Forward file buffer to microservice as multipart/form-data
  uploadFile: async (
    receiptId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<
    AdapterResult<
      { fileId: string; fileName: string; size: number },
      'bad-request' | 'not-found' | CommonErr
    >
  > => {
    try {
      // Create FormData to forward to microservice
      const FormData = (await import('form-data')).default
      const formData = new FormData()
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
      })

      const res = await axios.post<{
        content: { fileId: string; fileName: string; size: number }
      }>(`${BASE}/receipts/${receiptId}/upload`, formData as any, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })

      return ok(res.data.content)
    } catch (e) {
      const err = mapAxiosError(e)
      logger.error(
        {
          err: e,
          response: (e as AxiosError)?.response?.data,
        },
        `POST ${BASE}/receipts/${receiptId}/upload failed -> ${err}`
      )
      return fail(err)
    }
  },

  getDownloadUrl: async (
    receiptId: string
  ): Promise<
    AdapterResult<
      { url: string; expiresIn: number; fileId: string },
      'not-found' | CommonErr
    >
  > => {
    const r = await getJSON<{
      content: { url: string; expiresIn: number; fileId: string }
    }>(`${BASE}/receipts/${receiptId}/download`)
    return r.ok ? ok(r.data.content) : r
  },

  // <-- Upload file as base64 JSON (for Power Automate)
  uploadFileBase64: async (
    receiptId: string,
    base64Content: string,
    fileName?: string,
    metadata?: Record<string, string>
  ): Promise<
    AdapterResult<
      { fileId: string; fileName: string; size: number; source: string },
      'bad-request' | 'not-found' | CommonErr
    >
  > => {
    const r = await postJSON<{
      content: {
        fileId: string
        fileName: string
        size: number
        source: string
      }
    }>(`${BASE}/receipts/${receiptId}/upload-base64`, {
      fileContent: base64Content,
      fileName,
      metadata,
    })
    return r.ok ? ok(r.data.content) : r
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
  list: async (): Promise<AdapterResult<KeyBundle[], CommonErr>> => {
    const r = await getJSON<{ content: KeyBundle[] }>(`${BASE}/key-bundles`)
    return r.ok ? ok(r.data.content) : r
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<KeyBundle[], 'bad-request' | CommonErr>> => {
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
    const r = await getJSON<{ content: KeyBundle[] }>(
      `${BASE}/key-bundles/search?${params.toString()}`
    )
    return r.ok ? ok(r.data.content) : r
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
    includePreviousLoan: boolean = true
  ): Promise<
    AdapterResult<KeyBundleWithLoanStatusResponse, 'not-found' | CommonErr>
  > => {
    const queryParams = includePreviousLoan ? '' : '?includePreviousLoan=false'
    const r = await getJSON<{ content: KeyBundleWithLoanStatusResponse }>(
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
