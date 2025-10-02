import { loggedAxios as axios, logger } from '@onecore/utilities'
import { AxiosError } from 'axios'
import { keys } from '@onecore/types'
import Config from '../../common/config'
import { AdapterResult } from '../types' // keep this import path as in your repo

// Import types from @onecore/types
type Key = keys.v1.Key
type KeyLoan = keys.v1.KeyLoan
type KeySystem = keys.v1.KeySystem
type Log = keys.v1.Log
type PaginatedResponse<T> = keys.v1.PaginatedResponse<T>

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
  // important: return a LITERAL, not `unknown`
  return { ok: false, err }
}

/**
 * ---- HTTP wrapper -----------------------------------------------------------
 * Axios throws on non-2xx; we catch and map to literal error codes.
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
    // Check if response is an error status even if axios didn't throw
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
    // Check if response is an error status even if axios didn't throw
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
 * Microservice responses are shaped like { content: T }
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
  ): Promise<AdapterResult<Key[], 'bad-request' | CommonErr>> => {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          params.append(key, value.join(','))
        } else if (typeof value === 'string') {
          params.append(key, value)
        }
      }
    }

    const r = await getJSON<{ content: Key[] }>(
      `${BASE}/keys/search?${params.toString()}`
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
    // your delete returns { ...metadata } (no content); that's fine
    return deleteJSON(`${BASE}/keys/${id}`)
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
  ): Promise<AdapterResult<KeyLoan[], 'bad-request' | CommonErr>> => {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          params.append(key, value.join(','))
        } else if (typeof value === 'string') {
          params.append(key, value)
        }
      }
    }

    const r = await getJSON<{ content: KeyLoan[] }>(
      `${BASE}/key-loans/search?${params.toString()}`
    )
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
  ): Promise<AdapterResult<KeySystem[], 'bad-request' | CommonErr>> => {
    const params = new URLSearchParams()

    // Add all search parameters to query string
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Handle array values (e.g., fields array)
          params.append(key, value.join(','))
        } else if (typeof value === 'string') {
          params.append(key, value)
        }
      }
    }

    const r = await getJSON<{ content: KeySystem[] }>(
      `${BASE}/key-systems/search?${params.toString()}`
    )
    return r.ok ? ok(r.data.content) : r
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
}

/**
 * ---- LOGS -------------------------------------------------------------------
 * Read-only audit logs - no update or delete operations allowed
 */

export const LogsApi = {
  list: async (): Promise<AdapterResult<Log[], CommonErr>> => {
    const r = await getJSON<{ content: Log[] }>(`${BASE}/logs`)
    return r.ok ? ok(r.data.content) : r
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<Log[], 'bad-request' | CommonErr>> => {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          params.append(key, value.join(','))
        } else if (typeof value === 'string') {
          params.append(key, value)
        }
      }
    }

    const r = await getJSON<{ content: Log[] }>(
      `${BASE}/logs/search?${params.toString()}`
    )
    return r.ok ? ok(r.data.content) : r
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Log, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Log }>(`${BASE}/logs/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (
    payload: Partial<Log>
  ): Promise<AdapterResult<Log, 'bad-request' | CommonErr>> => {
    const r = await postJSON<{ content: Log }>(`${BASE}/logs`, payload)
    return r.ok ? ok(r.data.content) : r
  },
}
