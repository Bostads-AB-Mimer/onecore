import type { CreateContactError } from '../../adapters/contacts-adapter'

/**
 * The HTTP status core's own routes answer for a create failure. Route policy, so it lives
 * here and not in the adapter; shared by POST /v1/contacts and POST /auth/contacts/register.
 *
 * Only reachable before the contact exists — once it does, a route answers
 * success and reports later problems as warnings instead. A Record over the
 * error union, so a new service error code fails the typecheck until mapped.
 */
export const CREATE_CONTACT_STATUS: Record<
  CreateContactError,
  400 | 409 | 422 | 502 | 503
> = {
  'duplicate-contact': 409,
  'invalid-national-id': 422,
  'invalid-request': 400,
  'xpand-rejected': 422,
  'xpand-fault': 502,
  'xpand-auth-failed': 502,
  'xpand-malformed-response': 502,
  'xpand-unavailable': 503,
  'write-backend-not-configured': 503,
  'contacts-service-error': 502,
}
