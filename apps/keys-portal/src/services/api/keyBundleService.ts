import { GET, PATCH, POST, DELETE } from './core/base-api'
import type {
  KeyBundle,
  KeyBundleWithLoanStatusResponse,
  CreateKeyBundleRequest,
  UpdateKeyBundleRequest,
} from '../types'

/**
 * Get all key bundles
 */
export async function getAllKeyBundles(): Promise<KeyBundle[]> {
  const { data, error } = await GET('/key-bundles', {})

  if (error) {
    throw new Error('Failed to fetch key bundles')
  }

  return data?.content ?? []
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
 * Create a new key bundle
 */
export async function createKeyBundle(
  bundle: CreateKeyBundleRequest
): Promise<KeyBundle> {
  const { data, error } = await POST('/key-bundles', {
    body: bundle,
  })

  if (error) {
    throw new Error('Failed to create key bundle')
  }

  return data?.content as KeyBundle
}

/**
 * Update a key bundle
 */
export async function updateKeyBundle(
  id: string,
  updates: UpdateKeyBundleRequest
): Promise<KeyBundle> {
  const { data, error } = await PATCH('/key-bundles/{id}', {
    params: {
      path: { id },
    },
    body: updates,
  })

  if (error) {
    throw new Error('Failed to update key bundle')
  }

  return data?.content as KeyBundle
}

/**
 * Delete a key bundle
 */
export async function deleteKeyBundle(id: string): Promise<void> {
  const { error } = await DELETE('/key-bundles/{id}', {
    params: {
      path: { id },
    },
  })

  if (error) {
    throw new Error('Failed to delete key bundle')
  }
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
