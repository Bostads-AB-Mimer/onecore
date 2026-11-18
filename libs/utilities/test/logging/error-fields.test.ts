import {
  errorMessage,
  errorName,
  redactedMessage,
  serializeError,
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

describe('serializeError', () => {
  it('keeps the message of the cause', () => {
    const cause = new Error('connect ECONNREFUSED 127.0.0.1:5050')
    const err = new TypeError('fetch failed', { cause })

    const serialized = serializeError(err) as Record<string, unknown>

    expect(serialized.message).toBe(
      'fetch failed: connect ECONNREFUSED 127.0.0.1:5050'
    )
    expect(serialized.stack).toContain('caused by:')
    expect(Object.keys(serialized).sort()).toEqual(['message', 'stack', 'type'])
  })
})
