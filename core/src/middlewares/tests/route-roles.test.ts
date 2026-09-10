import { requiredRolesFor } from '../route-roles'

describe('requiredRolesFor', () => {
  it('gates contact writes on contacts:write alone', () => {
    expect(requiredRolesFor('/v1/contacts', 'POST')).toEqual(['contacts:write'])
    expect(requiredRolesFor('/v1/contacts/P1/relations', 'POST')).toEqual([
      'contacts:write',
    ])
    expect(
      requiredRolesFor('/v1/contacts/P1/relations/god_man/P2', 'DELETE')
    ).toEqual(['contacts:write'])
  })

  it('lets api-access or contacts:read read contacts', () => {
    expect(requiredRolesFor('/v1/contacts/P1', 'GET')).toEqual([
      'api-access',
      'contacts:read',
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
})
