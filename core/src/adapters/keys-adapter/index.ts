import { loggedAxios as axios, logger } from '@onecore/utilities'
import { AxiosError } from 'axios'
import Config from '../../common/config'
import { AdapterResult } from '../types' // keep this import path as in your repo

const BASE = Config.keysService.url

/**
 * ---- Shared helpers ---------------------------------------------------------
 */

type CommonErr = 'bad-request' | 'not-found' | 'conflict' | 'unauthorized' | 'forbidden' | 'unknown'

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
 * ---- Types (you can move these to @onecore/types later) ---------------------
 */

export interface Key {
  id: string
  keyName: string
  keySequenceNumber?: number
  flexNumber?: number
  rentalObjectCode?: string
  keyType: 'LGH' | 'PB' | 'FS' | 'HN'
  keySystemId?: string | null
  createdAt: string
  updatedAt: string
}

export interface KeyLoan {
  id: string
  keys: string                 // JSON string array per your DB (e.g. "[\"keyId1\",\"keyId2\"]")
  contact?: string
  lease?: string
  returnedAt?: string | null
  availableToNextTenantFrom?: string | null
  pickedUpAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export interface KeySystem {
  id: string
  systemCode: string
  name: string
  manufacturer?: string
  type: 'MECHANICAL' | 'ELECTRONIC' | 'HYBRID'
  propertyIds?: string         // JSON string array
  installationDate?: string | null
  isActive?: boolean
  description?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export interface Log {
  id: string
  userName: string
  eventType: 'creation' | 'update' | 'delete'
  objectType: 'key' | 'key_system' | 'key_loan'
  eventTime: string
  description?: string | null
}

/**
 * ---- HTTP wrapper -----------------------------------------------------------
 * Axios throws on non-2xx; we catch and map to literal error codes.
 */

async function getJSON<T>(url: string, headers?: Record<string, string>): Promise<AdapterResult<T, CommonErr>> {
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
  list: async (): Promise<AdapterResult<Key[], CommonErr>> => {
    const r = await getJSON<{ content: Key[] }>(`${BASE}/keys`)
    return r.ok ? ok(r.data.content) : r
  },

  get: async (id: string): Promise<AdapterResult<Key, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Key }>(`${BASE}/keys/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (payload: Partial<Key>): Promise<AdapterResult<Key, 'bad-request' | CommonErr>> => {
    const r = await postJSON<{ content: Key }>(`${BASE}/keys`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  update: async (id: string, payload: Partial<Key>): Promise<AdapterResult<Key, 'not-found' | 'bad-request' | CommonErr>> => {
    const r = await patchJSON<{ content: Key }>(`${BASE}/keys/${id}`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (id: string): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
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

  get: async (id: string): Promise<AdapterResult<KeyLoan, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: KeyLoan }>(`${BASE}/key-loans/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (payload: Partial<KeyLoan>): Promise<AdapterResult<KeyLoan, 'bad-request' | CommonErr>> => {
    const r = await postJSON<{ content: KeyLoan }>(`${BASE}/key-loans`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<KeyLoan>
  ): Promise<AdapterResult<KeyLoan, 'not-found' | 'bad-request' | CommonErr>> => {
    const r = await patchJSON<{ content: KeyLoan }>(`${BASE}/key-loans/${id}`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (id: string): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/key-loans/${id}`)
  },
}

/**
 * ---- KEY SYSTEMS ------------------------------------------------------------
 */

export const KeySystemsApi = {
  list: async (): Promise<AdapterResult<KeySystem[], CommonErr>> => {
    const r = await getJSON<{ content: KeySystem[] }>(`${BASE}/key-systems`)
    return r.ok ? ok(r.data.content) : r
  },

  get: async (id: string): Promise<AdapterResult<KeySystem, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: KeySystem }>(`${BASE}/key-systems/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (payload: Partial<KeySystem>): Promise<AdapterResult<KeySystem, 'bad-request' | 'conflict' | CommonErr>> => {
    const r = await postJSON<{ content: KeySystem }>(`${BASE}/key-systems`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<KeySystem>
  ): Promise<AdapterResult<KeySystem, 'not-found' | 'bad-request' | 'conflict' | CommonErr>> => {
    const r = await patchJSON<{ content: KeySystem }>(`${BASE}/key-systems/${id}`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (id: string): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/key-systems/${id}`)
  },
}

/**
 * ---- LOGS -------------------------------------------------------------------
 */

export const LogsApi = {
  list: async (): Promise<AdapterResult<Log[], CommonErr>> => {
    const r = await getJSON<{ content: Log[] }>(`${BASE}/logs`)
    return r.ok ? ok(r.data.content) : r
  },

  get: async (id: string): Promise<AdapterResult<Log, 'not-found' | CommonErr>> => {
    const r = await getJSON<{ content: Log }>(`${BASE}/logs/${id}`)
    return r.ok ? ok(r.data.content) : r
  },

  create: async (payload: Partial<Log>): Promise<AdapterResult<Log, 'bad-request' | CommonErr>> => {
    const r = await postJSON<{ content: Log }>(`${BASE}/logs`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  update: async (
    id: string,
    payload: Partial<Log>
  ): Promise<AdapterResult<Log, 'not-found' | 'bad-request' | CommonErr>> => {
    const r = await patchJSON<{ content: Log }>(`${BASE}/logs/${id}`, payload)
    return r.ok ? ok(r.data.content) : r
  },

  remove: async (id: string): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    return deleteJSON(`${BASE}/logs/${id}`)
  },
}
