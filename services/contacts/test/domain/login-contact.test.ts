import {
  LoginContactCandidate,
  pickLoginContact,
} from '@src/domain/login-contact'

const candidate = (
  overrides: Partial<LoginContactCandidate> & { contactCode: string }
): LoginContactCandidate => ({
  currentTenant: false,
  queueTime: false,
  xpandUser: false,
  createdAt: new Date('2020-01-01'),
  ...overrides,
})

describe('pickLoginContact', () => {
  it('is null without candidates', () => {
    expect(pickLoginContact([])).toBeNull()
  })

  it('picks the only candidate, not ambiguous', () => {
    expect(pickLoginContact([candidate({ contactCode: 'P1' })])).toEqual({
      contactCode: 'P1',
      ambiguous: false,
      candidates: ['P1'],
    })
  })

  it('prefers a current tenant over a newer contact with queue time', () => {
    const choice = pickLoginContact([
      candidate({
        contactCode: 'P2',
        queueTime: true,
        xpandUser: true,
        createdAt: new Date('2024-01-01'),
      }),
      candidate({
        contactCode: 'P1',
        currentTenant: true,
        createdAt: new Date('2018-01-01'),
      }),
    ])

    expect(choice).toMatchObject({ contactCode: 'P1', ambiguous: false })
  })

  it('prefers queue time over only an Xpand user', () => {
    const choice = pickLoginContact([
      candidate({ contactCode: 'P1', xpandUser: true }),
      candidate({ contactCode: 'P2', queueTime: true }),
    ])

    expect(choice?.contactCode).toBe('P2')
  })

  it('prefers a contact with an Xpand user over a newer one without (a supplier contact)', () => {
    const choice = pickLoginContact([
      candidate({ contactCode: 'P2', createdAt: new Date('2024-01-01') }),
      candidate({
        contactCode: 'P1',
        xpandUser: true,
        createdAt: new Date('2019-01-01'),
      }),
    ])

    expect(choice).toMatchObject({ contactCode: 'P1', ambiguous: false })
  })

  it('picks the newest when the signals tie, and flags it ambiguous', () => {
    const choice = pickLoginContact([
      candidate({
        contactCode: 'P1',
        queueTime: true,
        xpandUser: true,
        createdAt: new Date('2021-01-01'),
      }),
      candidate({
        contactCode: 'P2',
        queueTime: true,
        xpandUser: true,
        createdAt: new Date('2024-01-01'),
      }),
    ])

    expect(choice).toEqual({
      contactCode: 'P2',
      ambiguous: true,
      candidates: ['P2', 'P1'],
    })
  })

  it('does not depend on input order when created on the same day or without a date', () => {
    const a = candidate({ contactCode: 'P1', createdAt: null })
    const b = candidate({ contactCode: 'P2', createdAt: null })

    expect(pickLoginContact([a, b])?.contactCode).toBe('P2')
    expect(pickLoginContact([b, a])?.contactCode).toBe('P2')
  })

  it('ranks a contact with a creation date above one without', () => {
    const choice = pickLoginContact([
      candidate({ contactCode: 'P9', createdAt: null }),
      candidate({ contactCode: 'P1', createdAt: new Date('2000-01-01') }),
    ])

    expect(choice?.contactCode).toBe('P1')
  })
})
