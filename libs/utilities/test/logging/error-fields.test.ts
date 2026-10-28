import {
  errorMessage,
  errorName,
  redactedMessage,
} from '../../src/logging/error-fields'

describe('errorName', () => {
  it('returns the name of an Error', () => {
    expect(errorName(new TypeError('x'))).toBe('TypeError')
  })

  it('returns the type of anything else', () => {
    expect(errorName('x')).toBe('string')
  })
})

describe('errorMessage', () => {
  it('returns the message of an Error, or the value as a string', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage(42)).toBe('42')
  })
})

describe('redactedMessage', () => {
  it('replaces every given value, longest first, and ignores empty ones', () => {
    const err = new Error('Anna Berg <anna@example.com> rejected: Anna')

    expect(
      redactedMessage(err, ['Anna', 'Anna Berg', 'anna@example.com', null, ''])
    ).toBe('[redacted] <[redacted]> rejected: [redacted]')
  })
})
