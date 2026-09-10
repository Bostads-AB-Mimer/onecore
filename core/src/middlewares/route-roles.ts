/**
 * Which Keycloak realm roles a request needs, by path and method.
 *
 * requireRole is ANY-of, so a list means "one of these".
 */
export const requiredRolesFor = (path: string, method: string): string[] => {
  if (path.startsWith('/scan-receipt')) return ['scanner-upload']

  // All routes under /leases/for-csc require csc:get or api-access
  if (path.startsWith('/leases/for-csc') && method === 'GET') {
    return ['csc:get', 'api-access']
  }

  // All routes under invoices/notify-batch require invoice-notify:post or api-access
  if (path.startsWith('/invoices/notify-batch') && method === 'POST') {
    return ['invoice-notify:post', 'api-access']
  }

  // Infobip email delivery-report webhook — authenticated via a Keycloak
  // service account (client_credentials) holding the infobip-webhook role.
  if (path.startsWith('/webhooks/infobip')) return ['infobip-webhook']

  // Creating a contact or changing its relations writes to the system of
  // record and cannot be undone, so it is gated separately from reading.
  // requireRole is ANY-of, so contacts:write must stand alone here —
  // listing api-access alongside it would open the write to every
  // api-access holder.
  if (
    path.startsWith('/v1/contacts') &&
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
