import { GET, PUT, POST, DELETE } from './core/base-api'
import type {
  KeyBundle,
  KeyBundleDetailsResponse,
  BundleWithLoanedKeysInfo,
  CreateKeyBundleRequest,
  UpdateKeyBundleRequest,
  PaginatedResponse,
} from '../types'

/**
 * Get all key bundles with pagination
 */
export async function getAllKeyBundles(
  page: number = 1,
  limit: number = 60
): Promise<PaginatedResponse<KeyBundle>> {
  const { data, error } = await GET('/key-bundles', {
    params: {
      query: { page, limit },
    },
  })

  if (error) {
    throw new Error('Failed to fetch key bundles')
  }

  return {
    content: data?.content ?? [],
    _meta: data?._meta ?? { totalRecords: 0, page: 1, limit: 60, count: 0 },
    _links: data?._links ?? [],
  }
}

/**
 * Search for key bundles by name with pagination
 */
export async function searchKeyBundles(
  query: string,
  page: number = 1,
  limit: number = 60
): Promise<PaginatedResponse<KeyBundle>> {
  const { data, error } = await GET('/key-bundles/search', {
    params: {
      query: {
        q: query,
        fields: 'name,description',
        page,
        limit,
      },
    },
  })

  if (error) {
    throw new Error('Failed to search key bundles')
  }

  return {
    content: data?.content ?? [],
    _meta: data?._meta ?? { totalRecords: 0, page: 1, limit: 60, count: 0 },
    _links: data?._links ?? [],
  }
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
  const { data, error } = await PUT('/key-bundles/{id}', {
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
export async function getKeyBundleDetails(
  id: string,
  options?: {
    includeLoans?: boolean
    includeEvents?: boolean
    includeKeySystem?: boolean
  }
): Promise<KeyBundleDetailsResponse | null> {
  const queryParams: Record<string, boolean> = {}
  if (options?.includeLoans) queryParams.includeLoans = true
  if (options?.includeEvents) queryParams.includeEvents = true
  if (options?.includeKeySystem) queryParams.includeKeySystem = true

  const { data, error } = await GET('/key-bundles/{id}/keys-with-loan-status', {
    params: {
      path: { id },
      query: queryParams,
    },
  })

  if (error) {
    throw new Error('Failed to fetch key bundle with loan status')
  }

  return (data?.content as KeyBundleDetailsResponse) ?? null
}

/**
 * Get all key bundles that have keys loaned to a specific contact
 * Returns basic bundle info with counts of loaned vs total keys
 */
export async function getBundlesByContactWithLoanedKeys(
  contactCode: string
): Promise<BundleWithLoanedKeysInfo[]> {
  const { data, error } = await GET(
    '/key-bundles/by-contact/{contactCode}/with-loaned-keys',
    {
      params: {
        path: { contactCode },
      },
    }
  )

  if (error) {
    throw new Error('Failed to fetch bundles for contact')
  }

  return (data?.content as BundleWithLoanedKeysInfo[]) ?? []
}

/**
 * Get all key bundles that contain a specific key
 */
export async function getKeyBundlesByKeyId(
  keyId: string
): Promise<KeyBundle[]> {
  const { data, error } = await GET('/key-bundles/by-key/{keyId}', {
    params: {
      path: { keyId },
    },
  })

  if (error) {
    throw new Error('Failed to fetch bundles by key')
  }

  return data?.content ?? []
}
