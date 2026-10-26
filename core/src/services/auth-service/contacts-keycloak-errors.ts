import { isAxiosError } from 'axios'
import { logger } from '@onecore/utilities'

type KeycloakOAuthError = {
  error?: string
  error_description?: string
}

function keycloakOAuthErrorData(
  error: unknown
): KeycloakOAuthError | undefined {
  if (!isAxiosError(error)) {
    return undefined
  }
  const data = error.response?.data
  if (data && typeof data === 'object') {
    return data as KeycloakOAuthError
  }
  return undefined
}

/** OAuth token/logout endpoint failures: invalid_grant → 400, everything else → 502. */
export function httpStatusForContactsKeycloakError(error: unknown): number {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const oauth = keycloakOAuthErrorData(error)
    if (status === 400 && oauth?.error === 'invalid_grant') {
      return 400
    }
    return 502
  }
  return 502
}

export function bodyForContactsKeycloakError(httpStatus: number): {
  error: string
} {
  return httpStatus === 400
    ? { error: 'invalid_grant' }
    : { error: 'keycloak_unavailable' }
}

/** Never log raw Axios errors — config.data contains secrets and grant values. */
export function logContactsKeycloakTokenError(
  context: string,
  error: unknown
): void {
  const oauth = keycloakOAuthErrorData(error)
  if (isAxiosError(error)) {
    logger.error({
      msg: context,
      keycloakStatus: error.response?.status,
      keycloakError: oauth?.error,
      keycloakErrorDescription: oauth?.error_description,
    })
    return
  }
  const message = error instanceof Error ? error.message : 'Unknown error'
  logger.error({ msg: context, err: message })
}
