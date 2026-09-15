import {
  LeaseTerminationConfirmationNotificationSchema,
  TenantNotificationSchema,
  TenantNotificationType,
} from '@onecore/types'

const validTerminationNotification = {
  type: TenantNotificationType.LeaseTerminationConfirmation,
  to: 'tenant@example.com',
  contactCode: 'P123456',
  firstName: 'Anna',
  address: 'Testgatan 1',
  leaseId: '307-002-11-0201/11',
  endDate: '2026-10-31',
  objectId: '123-456',
  rentalType: 'Bilplats' as const,
  parkingSpaceId: '123-456-789',
}

describe('LeaseTerminationConfirmationNotificationSchema', () => {
  it('accepts a complete payload', () => {
    expect(
      LeaseTerminationConfirmationNotificationSchema.safeParse(
        validTerminationNotification
      ).success
    ).toBe(true)
  })

  it('accepts optional correlationId for cross-system tracing', () => {
    expect(
      LeaseTerminationConfirmationNotificationSchema.safeParse({
        ...validTerminationNotification,
        correlationId: 'tenfast-evt-123',
      }).success
    ).toBe(true)
  })

  it('rejects an invalid recipient email', () => {
    expect(
      LeaseTerminationConfirmationNotificationSchema.safeParse({
        ...validTerminationNotification,
        to: 'not-an-email',
      }).success
    ).toBe(false)
  })

  it('rejects an unsupported rentalType', () => {
    expect(
      LeaseTerminationConfirmationNotificationSchema.safeParse({
        ...validTerminationNotification,
        rentalType: 'Bostad',
      }).success
    ).toBe(false)
  })

  it('rejects an invalid endDate', () => {
    expect(
      LeaseTerminationConfirmationNotificationSchema.safeParse({
        ...validTerminationNotification,
        endDate: 'not-a-date',
      }).success
    ).toBe(false)
  })

  it('coerces endDate to a Date', () => {
    const parsed = LeaseTerminationConfirmationNotificationSchema.safeParse(
      validTerminationNotification
    )

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.endDate).toBeInstanceOf(Date)
    }
  })

  it('does not accept triggeredByUser on the public schema', () => {
    const parsed = LeaseTerminationConfirmationNotificationSchema.safeParse({
      ...validTerminationNotification,
      triggeredByUser: 'Evil Actor',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('triggeredByUser')
    }
  })
})

describe('TenantNotificationSchema', () => {
  it('parses lease-termination-confirmation via the discriminated union', () => {
    const parsed = TenantNotificationSchema.safeParse(
      validTerminationNotification
    )

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.type).toBe(
        TenantNotificationType.LeaseTerminationConfirmation
      )
    }
  })
})
