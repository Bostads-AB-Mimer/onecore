import { mapInfobipStatus } from './delivery-report'

describe('mapInfobipStatus', () => {
  it('maps DELIVERED group to delivered', () => {
    expect(
      mapInfobipStatus({
        groupName: 'DELIVERED',
        name: 'DELIVERED_TO_HANDSET',
      })
    ).toBe('delivered')
    expect(
      mapInfobipStatus({
        groupName: 'DELIVERED',
        name: 'DELIVERED_TO_OPERATOR',
      })
    ).toBe('delivered')
  })

  it('returns null for PENDING (non-terminal — leave row unchanged)', () => {
    expect(
      mapInfobipStatus({
        groupName: 'PENDING',
        name: 'PENDING_ENROUTE',
      })
    ).toBeNull()
  })

  it('maps UNDELIVERABLE/EXPIRED/REJECTED to failed', () => {
    expect(
      mapInfobipStatus({
        groupName: 'UNDELIVERABLE',
        name: 'UNDELIVERABLE_NOT_DELIVERED',
      })
    ).toBe('failed')
    expect(
      mapInfobipStatus({ groupName: 'EXPIRED', name: 'EXPIRED_EXPIRED' })
    ).toBe('failed')
    expect(
      mapInfobipStatus({ groupName: 'REJECTED', name: 'REJECTED_NETWORK' })
    ).toBe('failed')
  })

  it.each([
    [6011, 'soft bounce'],
    [6012, 'hard bounce'],
    [6034, 'suppressed bounce'],
  ])('maps documented bounce code %i (%s) to bounced', (id) => {
    expect(
      mapInfobipStatus(
        { groupName: 'UNDELIVERABLE', name: 'UNDELIVERABLE_REJECTED_OPERATOR' },
        { id }
      )
    ).toBe('bounced')
  })

  it('maps an email bounce to bounced via the error name/description text', () => {
    expect(
      mapInfobipStatus(
        { groupName: 'UNDELIVERABLE', name: 'UNDELIVERABLE_REJECTED_OPERATOR' },
        { id: 9999, description: 'Hard bounce from recipient mailbox' }
      )
    ).toBe('bounced')
  })

  it('maps a permanent recipient-side (USER_ERRORS) failure to bounced', () => {
    // Real payload captured live: non-existent recipient domain.
    expect(
      mapInfobipStatus(
        { groupName: 'UNDELIVERABLE', name: 'UNDELIVERABLE_NOT_DELIVERED' },
        {
          id: 6037,
          name: 'EC_RECIPIENT_DOMAIN_MX_NOT_FOUND',
          description: 'Domain MX not found or unavaliable',
          groupName: 'USER_ERRORS',
          permanent: true,
        }
      )
    ).toBe('bounced')
  })

  it('keeps a permanent NON-recipient (system/operator) failure as failed', () => {
    expect(
      mapInfobipStatus(
        { groupName: 'REJECTED', name: 'REJECTED_NETWORK' },
        {
          id: 500,
          name: 'EC_SYSTEM_ERROR',
          description: 'System error',
          groupName: 'SYSTEM_ERRORS',
          permanent: true,
        }
      )
    ).toBe('failed')
  })

  it('keeps a transient recipient error (permanent:false) as failed', () => {
    expect(
      mapInfobipStatus(
        { groupName: 'UNDELIVERABLE', name: 'UNDELIVERABLE_NOT_DELIVERED' },
        {
          id: 9000,
          name: 'EC_TEMP',
          description: 'Temporary issue',
          groupName: 'USER_ERRORS',
          permanent: false,
        }
      )
    ).toBe('failed')
  })

  it('keeps a non-bounce failure error as failed (not bounced)', () => {
    expect(
      mapInfobipStatus(
        { groupName: 'UNDELIVERABLE', name: 'UNDELIVERABLE_NOT_DELIVERED' },
        {
          id: 1,
          name: 'EC_UNKNOWN_SUBSCRIBER',
          description: 'Unknown Subscriber',
        }
      )
    ).toBe('failed')
  })

  it('falls back to failed for an unknown group name', () => {
    expect(mapInfobipStatus({ groupName: 'SOMETHING_NEW' })).toBe('failed')
  })

  it('is case-insensitive on the group name', () => {
    expect(mapInfobipStatus({ groupName: 'delivered' })).toBe('delivered')
  })
})
