import { deriveDispatchStatus } from '../dispatch-status'

describe('deriveDispatchStatus', () => {
  it('scheduled when any recipient is scheduled', () => {
    expect(deriveDispatchStatus(['scheduled', 'delivered'])).toBe('scheduled')
  })
  it('cancelled only when all are cancelled', () => {
    expect(deriveDispatchStatus(['cancelled', 'cancelled'])).toBe('cancelled')
  })
  it('sending while any recipient is still pending/sent', () => {
    expect(deriveDispatchStatus(['pending', 'delivered'])).toBe('sending')
    expect(deriveDispatchStatus(['sent'])).toBe('sending')
  })
  it('delivered when all terminal and all delivered', () => {
    expect(deriveDispatchStatus(['delivered', 'delivered'])).toBe('delivered')
  })
  it('partially_delivered when some delivered, some failed/bounced', () => {
    expect(deriveDispatchStatus(['delivered', 'failed'])).toBe(
      'partially_delivered'
    )
    expect(deriveDispatchStatus(['delivered', 'bounced'])).toBe(
      'partially_delivered'
    )
  })
  it('failed when all terminal and none delivered', () => {
    expect(deriveDispatchStatus(['failed', 'bounced'])).toBe('failed')
  })
  it('failed for an empty recipient set (edge)', () => {
    expect(deriveDispatchStatus([])).toBe('failed')
  })
})
