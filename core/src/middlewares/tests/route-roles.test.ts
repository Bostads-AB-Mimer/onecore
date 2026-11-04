import { requiredRolesFor } from '../route-roles'

describe('requiredRolesFor', () => {
  it('gates creating a contact on contacts:write alone', () => {
    expect(requiredRolesFor('/v1/contacts', 'POST')).toEqual(['contacts:write'])
  })

  // Relations are reversible, so they sit with the other caseworker writes
  // rather than behind the Xpand-write role. Pinned in both directions so
  // neither policy drifts into the other.
  it('does not gate relation writes on contacts:write', () => {
    expect(requiredRolesFor('/v1/contacts/P1/relations', 'POST')).toEqual([
      'api-access',
    ])
    expect(
      requiredRolesFor('/v1/contacts/P1/relations/god_man/P2', 'DELETE')
    ).toEqual(['api-access'])
  })

  it('lets api-access or contacts:read read contacts', () => {
    expect(requiredRolesFor('/v1/contacts/P1', 'GET')).toEqual([
      'api-access',
      'contacts:read',
    ])
  })

  it('gates lease termination confirmation on its role or api-access', () => {
    expect(
      requiredRolesFor(
        '/v1/tenant-notifications/lease-termination-confirmation',
        'POST'
      )
    ).toEqual(['tenant-notifications:lease-termination', 'api-access'])
    expect(requiredRolesFor('/v1/tenant-notifications', 'POST')).toEqual([
      'api-access',
    ])
  })

  it('gates mimer-contacts token helpers on contact-auth only', () => {
    expect(requiredRolesFor('/auth/contacts/token', 'POST')).toEqual([
      'contact-auth',
    ])
    expect(requiredRolesFor('/auth/contacts/refresh', 'POST')).toEqual([
      'contact-auth',
    ])
    expect(requiredRolesFor('/v1/auth/contacts/token', 'POST')).toEqual([
      'contact-auth',
    ])
    expect(requiredRolesFor('/v1/auth/contacts/refresh', 'POST')).toEqual([
      'contact-auth',
    ])
    expect(requiredRolesFor('/auth/contacts/logout', 'POST')).toEqual([
      'contact-auth',
    ])
    expect(requiredRolesFor('/auth/contacts/token', 'GET')).toEqual([
      'api-access',
    ])
  })

  // contact-auth alone must not register: a leaked token-helper credential would otherwise
  // be able to create contacts and logins.
  it('gates registration on contacts:register alone', () => {
    expect(requiredRolesFor('/auth/contacts/register', 'POST')).toEqual([
      'contacts:register',
    ])
    expect(requiredRolesFor('/v1/auth/contacts/register', 'POST')).toEqual([
      'contacts:register',
    ])
    expect(requiredRolesFor('/AUTH/Contacts/Register', 'POST')).toEqual([
      'contacts:register',
    ])
    expect(requiredRolesFor('/auth/contacts/register/', 'POST')).toEqual([
      'contacts:register',
    ])
  })

  // The handlers' (.*) prefix lets any route be reached under this path, so the narrow role
  // must not carry over to them.
  it('does not gate other routes reached through the registration path on contacts:register', () => {
    expect(
      requiredRolesFor('/auth/contacts/register/files/upload', 'POST')
    ).not.toContain('contacts:register')
    expect(
      requiredRolesFor(
        '/auth/contacts/register/component-categories/1',
        'DELETE'
      )
    ).toEqual(['api-access'])
    expect(requiredRolesFor('/auth/contacts/register', 'GET')).toEqual([
      'api-access',
    ])
  })

  it('keeps the existing special cases', () => {
    expect(requiredRolesFor('/scan-receipt/x', 'POST')).toEqual([
      'scanner-upload',
    ])
    expect(requiredRolesFor('/leases/for-csc', 'GET')).toEqual([
      'csc:get',
      'api-access',
    ])
    expect(requiredRolesFor('/invoices/notify-batch', 'POST')).toEqual([
      'invoice-notify:post',
      'api-access',
    ])
    expect(requiredRolesFor('/webhooks/infobip/x', 'POST')).toEqual([
      'infobip-webhook',
    ])
    expect(requiredRolesFor('/invoice-channels/x', 'GET')).toEqual([
      'invoice-channels:read',
      'api-access',
    ])
  })

  it('falls back to api-access', () => {
    expect(requiredRolesFor('/leases/1', 'GET')).toEqual(['api-access'])
    expect(requiredRolesFor('/v1/contacts/P1', 'PUT')).toEqual(['api-access'])
  })

  it('is case-insensitive like the router', () => {
    expect(requiredRolesFor('/V1/Contacts', 'POST')).toEqual(['contacts:write'])
    expect(
      requiredRolesFor('/V1/contacts/P1/Relations/god_man/P2', 'DELETE')
    ).toEqual(['api-access'])
    expect(requiredRolesFor('/Scan-Receipt/x', 'POST')).toEqual([
      'scanner-upload',
    ])
    expect(
      requiredRolesFor(
        '/V1/Tenant-Notifications/Lease-Termination-Confirmation',
        'POST'
      )
    ).toEqual(['tenant-notifications:lease-termination', 'api-access'])
  })

  it('pins the method conjunctions on the special cases', () => {
    expect(requiredRolesFor('/leases/for-csc', 'POST')).toEqual(['api-access'])
    expect(requiredRolesFor('/invoices/notify-batch', 'GET')).toEqual([
      'api-access',
    ])
  })

  it('does not gate deletes outside contacts on contacts:write', () => {
    expect(requiredRolesFor('/keys/abc', 'DELETE')).toEqual(['api-access'])
  })
})
