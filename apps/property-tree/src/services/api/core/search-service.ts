import { GET } from './base-api'
import type { components } from './generated/api-types'

type SearchResult = components['schemas']['SearchResult']

async function search(q: string): Promise<Array<SearchResult>> {
  const { data, error } = await GET('/search', {
    params: { query: { q } },
  })

  if (error) throw error

  return data?.content || []
}

export const searchService = { search }
