// Dependency-free so app bootstrap and the file-storage routes can import these
// without pulling in the guides adapters.

/** Keycloak realm role that allows creating, editing and deleting guides. */
export const GUIDES_ADMIN_ROLE = 'guides-admin'

/**
 * Storage key prefix owned by the guides API. Files under it are created and
 * removed through /guides only, never through the generic /files routes.
 */
export const GUIDE_STORAGE_PREFIX = 'guide/'
