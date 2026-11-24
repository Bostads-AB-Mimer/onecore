import { requiredRolesFor } from '../route-roles'

describe('requiredRolesFor', () => {
  it('gates creating a contact on contacts:write alone', () => {
    expect(requiredRolesFor('/v1/contacts', 'POST')).toEqual(['contacts:write'])
  })

  it('gates making leasing re-pull contacts on contacts:write alone', () => {
    expect(requiredRolesFor('/v1/contacts/sync-to-leasing', 'POST')).toEqual([
      'contacts:write',
    ])
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

  it('gates the home insurance list and export on home-insurance:read alone', () => {
    expect(requiredRolesFor('/leases/home-insurances', 'GET')).toEqual([
      'home-insurance:read',
    ])
    expect(requiredRolesFor('/Leases/Home-Insurances/Export', 'GET')).toEqual([
      'home-insurance:read',
    ])
  })

  it('gates changing a home insurance row on home-insurance:write alone', () => {
    // A lease ID with an encoded slash, and one sent unencoded.
    expect(
      requiredRolesFor(
        '/leases/705-001-01-0101%2F1/home-insurance/rows/abc',
        'PATCH'
      )
    ).toEqual(['home-insurance:write'])
    expect(
      requiredRolesFor(
        '/leases/705-001-01-0101/1/home-insurance/rows/abc',
        'PATCH'
      )
    ).toEqual(['home-insurance:write'])
  })

  it('gates the rent row list and export on home-insurance:read alone', () => {
    expect(requiredRolesFor('/leases/rent-rows', 'GET')).toEqual([
      'home-insurance:read',
    ])
    expect(requiredRolesFor('/leases/rent-rows/export', 'GET')).toEqual([
      'home-insurance:read',
    ])
  })

  it('gates setting a home insurance end date on home-insurance:write alone', () => {
    expect(
      requiredRolesFor(
        '/leases/705-001-01-0101%2F1/rent-rows/home-insurance-end-date',
        'POST'
      )
    ).toEqual(['home-insurance:write'])
  })

  it('gates the open invoice list and export on open-invoices:read alone', () => {
    expect(requiredRolesFor('/reports/open-invoices', 'GET')).toEqual([
      'open-invoices:read',
    ])
    expect(requiredRolesFor('/Reports/Open-Invoices/Export', 'GET')).toEqual([
      'open-invoices:read',
    ])
    // Only the exact path, not one that merely starts the same.
    expect(requiredRolesFor('/reports/open-invoices-other', 'GET')).toEqual([
      'api-access',
    ])
  })

  it('leaves the Mina sidor home insurance routes on api-access', () => {
    expect(requiredRolesFor('/leases/123/home-insurance', 'GET')).toEqual([
      'api-access',
    ])
    expect(
      requiredRolesFor('/leases/123/home-insurance/cancel', 'POST')
    ).toEqual(['api-access'])
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
