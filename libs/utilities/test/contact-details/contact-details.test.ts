import {
  contactDetailsMode,
  placeholderEmailAddress,
  placeholderPhoneNumber,
} from '../../src/contact-details'

const env = (vars: Record<string, string>) => vars as typeof process.env

describe('contactDetailsMode', () => {
  it.each(['real', 'placeholder', 'redacted'] as const)(
    'returns %s when CONTACT_DETAILS__MODE is %s',
    (mode) => {
      expect(
        contactDetailsMode(
          env({ CONTACT_DETAILS__MODE: mode, NODE_ENV: 'test' })
        )
      ).toBe(mode)
    }
  )

  it('is real when unset in production', () => {
    expect(contactDetailsMode(env({ NODE_ENV: 'production' }))).toBe('real')
  })

  it('is real when empty in production', () => {
    expect(
      contactDetailsMode(
        env({ CONTACT_DETAILS__MODE: '', NODE_ENV: 'production' })
      )
    ).toBe('real')
  })

  it('is redacted when unset outside production', () => {
    expect(contactDetailsMode(env({ NODE_ENV: 'test' }))).toBe('redacted')
  })

  it('is redacted when empty outside production', () => {
    expect(
      contactDetailsMode(env({ CONTACT_DETAILS__MODE: '', NODE_ENV: 'test' }))
    ).toBe('redacted')
  })

  it('is redacted when both are unset', () => {
    expect(contactDetailsMode(env({}))).toBe('redacted')
  })

  it.each(['REAL', 'bogus'])('falls back to redacted for %s', (mode) => {
    expect(
      contactDetailsMode(
        env({ CONTACT_DETAILS__MODE: mode, NODE_ENV: 'production' })
      )
    ).toBe('redacted')
  })
})

describe('placeholderEmailAddress', () => {
  it('builds the address from the contact code', () => {
    expect(placeholderEmailAddress('P123456')).toBe(
      'redacted+P123456@example.invalid'
    )
  })

  it('trims the contact code', () => {
    expect(placeholderEmailAddress('P123456   ')).toBe(
      'redacted+P123456@example.invalid'
    )
  })
})

describe('placeholderPhoneNumber', () => {
  const codes = Array.from({ length: 1000 }, (_, i) => `P${100000 + i}`)

  it('is stable for the same code', () => {
    expect(placeholderPhoneNumber('P123456')).toBe(
      placeholderPhoneNumber('P123456')
    )
  })

  it('ignores surrounding whitespace', () => {
    expect(placeholderPhoneNumber('P123456   ')).toBe(
      placeholderPhoneNumber('P123456')
    )
  })

  it('always falls in the reserved range', () => {
    for (const code of codes) {
      expect(placeholderPhoneNumber(code)).toMatch(
        /^070-174 06 (0[5-9]|[1-9]\d)$/
      )
    }
  })

  it('reaches both ends of the range', () => {
    const values = new Set(codes.map(placeholderPhoneNumber))
    expect(values.has('070-174 06 05')).toBe(true)
    expect(values.has('070-174 06 99')).toBe(true)
  })
})
