import { GET } from './baseApi'
import type { paths } from './generated/api-types'

type KeyBundleSearchParams =
  paths['/key-bundles/search']['get']['parameters']['query']

type KeyBundleSearchResponse =
  paths['/key-bundles/search']['get']['responses']['200']['content']['application/json']

export interface KeyBundle {
  id: string
  name: string
  keys: string
  description?: string | null
}

/**
 * Search for key bundles by name
 */
export async function searchKeyBundles(query: string): Promise<KeyBundle[]> {
  const { data, error } = await GET('/key-bundles/search', {
    params: {
      query: {
        q: query,
        fields: 'name,description',
      } as KeyBundleSearchParams,
    },
  })

  if (error) {
    throw new Error('Failed to search key bundles')
  }

  return (data as KeyBundleSearchResponse)?.content ?? []
}

/**
 * Get a key bundle by ID
 */
export async function getKeyBundleById(id: string): Promise<KeyBundle | null> {
  const { data, error } = await GET('/key-bundles/{id}', {
    params: {
      path: { id },
    },
  })

  if (error) {
    return null
  }

  return (data?.content as KeyBundle) ?? null
}
