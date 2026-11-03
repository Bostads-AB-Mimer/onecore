import { loggedAxios as axios } from '@onecore/utilities'
import { communication } from '@onecore/types'

import config from '../../common/config'
import { AdapterResult } from '../types'

type ReleaseNote = communication.ReleaseNote

const baseUrl = () => `${config.communicationService.url}/release-notes`

const noteUrl = (id: string) => `${baseUrl()}/${encodeURIComponent(id)}`

function toFailure<E extends string>(
  err: unknown,
  known: Partial<Record<number, E>>
): { ok: false; err: E | 'error'; statusCode: number } {
  if (axios.isAxiosError(err) && err.response) {
    const status = err.response.status
    return { ok: false, err: known[status] ?? 'error', statusCode: status }
  }
  return { ok: false, err: 'error', statusCode: 500 }
}

export const listReleaseNotes = async (options: {
  app?: communication.ReleaseNoteApp
  includeDrafts?: boolean
}): Promise<AdapterResult<ReleaseNote[], 'error' | 'bad-request'>> => {
  try {
    const result = await axios.get(baseUrl(), {
      params: {
        app: options.app,
        includeDrafts: options.includeDrafts ? 'true' : undefined,
      },
    })
    return { ok: true, data: result.data }
  } catch (err) {
    return toFailure(err, { 400: 'bad-request' })
  }
}

export const createReleaseNote = async (
  params: communication.CreateReleaseNoteParams
): Promise<AdapterResult<ReleaseNote, 'error' | 'bad-request'>> => {
  try {
    const result = await axios.post(baseUrl(), params)
    return { ok: true, data: result.data }
  } catch (err) {
    return toFailure(err, { 400: 'bad-request' })
  }
}

export const updateReleaseNote = async (
  id: string,
  params: communication.UpdateReleaseNote
): Promise<
  AdapterResult<ReleaseNote, 'error' | 'bad-request' | 'not-found'>
> => {
  try {
    const result = await axios.put(noteUrl(id), params)
    return { ok: true, data: result.data }
  } catch (err) {
    return toFailure(err, { 400: 'bad-request', 404: 'not-found' })
  }
}

export const deleteReleaseNote = async (
  id: string
): Promise<AdapterResult<null, 'error' | 'not-found'>> => {
  try {
    await axios.delete(noteUrl(id))
    return { ok: true, data: null }
  } catch (err) {
    return toFailure(err, { 404: 'not-found' })
  }
}
