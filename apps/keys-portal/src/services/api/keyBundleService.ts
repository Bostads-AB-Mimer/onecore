import { GET } from './core/base-api'
import type { KeyBundle, KeyBundleWithLoanStatusResponse } from '../types'

/**
 * Search for key bundles by name
 */
export async function searchKeyBundles(query: string): Promise<KeyBundle[]> {
  const { data, error } = await GET('/key-bundles/search', {
    params: {
      query: {
        q: query,
        fields: 'name,description',
      },
    },
  })

  if (error) {
    throw new Error('Failed to search key bundles')
  }

  return data?.content ?? []
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

/**
 * Get all keys in a bundle with their maintenance loan status
 * Returns bundle info and all keys with information about active maintenance loans
 */
export async function getKeyBundleWithLoanStatus(
  id: string
): Promise<KeyBundleWithLoanStatusResponse | null> {
  const { data, error } = await GET('/key-bundles/{id}/keys-with-loan-status', {
    params: {
      path: { id },
    },
  })

  if (error) {
    throw new Error('Failed to fetch key bundle with loan status')
  }

  return (data?.content as KeyBundleWithLoanStatusResponse) ?? null
}
