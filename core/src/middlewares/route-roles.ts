/**
 * Which Keycloak realm roles a request needs, by path and method.
 *
 * requireRole is ANY-of, so a list means "one of these".
 */
export const requiredRolesFor = (rawPath: string, method: string): string[] => {
  // @koa/router matches paths case-insensitively, so compare in lower case —
  // otherwise POST /V1/contacts reaches the handler but is gated as api-access.
  const path = rawPath.toLowerCase()

  if (path.startsWith('/scan-receipt')) return ['scanner-upload']

  // All routes under /leases/for-csc require csc:get or api-access
  if (path.startsWith('/leases/for-csc') && method === 'GET') {
    return ['csc:get', 'api-access']
  }

  // All routes under invoices/notify-batch require invoice-notify:post or api-access
  if (path.startsWith('/invoices/notify-batch') && method === 'POST') {
    return ['invoice-notify:post', 'api-access']
  }

  if (
    path.startsWith(
      '/v1/tenant-notifications/lease-termination-confirmation'
    ) &&
    method === 'POST'
  ) {
    return ['tenant-notifications:lease-termination', 'api-access']
  }

  // Infobip email delivery-report webhook — authenticated via a Keycloak
  // service account (client_credentials) holding the infobip-webhook role.
  if (path.startsWith('/webhooks/infobip')) return ['infobip-webhook']

  // Creating a contact writes to Xpand, the system of record, and ONECore
  // cannot remove it again — so it is gated separately from reading, on
  // contacts:write alone: requireRole is ANY-of, so listing api-access
  // alongside it would open the write to every api-access holder.
  //
  // Relations are deliberately NOT gated on it. They mutate the contacts DB,
  // removal is a soft delete that keeps history, and a failed propagation
  // rolls the whole change back — so they are no more consequential than the
  // lease and invoice writes that already sit behind plain api-access, and
  // they fall through to it below.
  if (
    path.startsWith('/v1/contacts') &&
    !path.includes('/relations') &&
    (method === 'POST' || method === 'DELETE')
  ) {
    return ['contacts:write']
  }

  if (path.startsWith('/v1/contacts') && method === 'GET') {
    return ['api-access', 'contacts:read']
  }

  if (path.startsWith('/invoice-channels')) {
    return ['invoice-channels:read', 'api-access']
  }

  return ['api-access']
}
