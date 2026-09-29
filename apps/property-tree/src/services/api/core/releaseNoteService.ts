import { DELETE, GET, POST, PUT } from './baseApi'
import type { components } from './generated/api-types'

type CreateReleaseNote = components['schemas']['CreateReleaseNote']
type UpdateReleaseNote = components['schemas']['UpdateReleaseNote']

export const releaseNoteService = {
  // includeDrafts is ignored by core unless the user has release-notes:write.
  async getAll(options: { includeDrafts?: boolean } = {}) {
    const { data, error } = await GET('/release-notes', {
      params: { query: { includeDrafts: options.includeDrafts } },
    })
    if (error) throw error
    return {
      notes: data?.content ?? [],
      canManage: data?.capabilities?.canManage ?? false,
    }
  },

  async create(body: CreateReleaseNote) {
    const { data, error } = await POST('/release-notes', { body })
    if (error) throw error
    return data?.content
  },

  async update(id: string, body: UpdateReleaseNote) {
    const { data, error } = await PUT('/release-notes/{id}', {
      params: { path: { id } },
      body,
    })
    if (error) throw error
    return data?.content
  },

  async remove(id: string): Promise<void> {
    const { error } = await DELETE('/release-notes/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
  },
}
