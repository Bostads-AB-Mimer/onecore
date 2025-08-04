import { GET } from './core/base-api'
import type { components } from './core/generated/api-types'

export type SearchResult = components['schemas']['SearchResult']

export const searchService = {
  async search(q: string) {
    const { data, error } = await GET('/search', {
      params: { query: { q } },
    })

    if (error) throw error
    return data?.content ?? []
  },
}
