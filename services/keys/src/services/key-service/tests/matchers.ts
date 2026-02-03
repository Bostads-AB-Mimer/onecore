/**
 * Custom Jest matchers for domain-specific assertions
 *
 * Adopted from services/leasing test patterns
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinSeconds(expected: Date, seconds?: number): R
      toBeRecentDate(maxAgeSeconds?: number): R
      toBeStartOfDayUTC(): R
      toBeNearDate(expected: Date, toleranceMs?: number): R
    }
  }
}

expect.extend({
  /**
   * Checks if two dates are within a specified number of seconds of each other
   * Useful for comparing timestamps that may have slight variations due to test execution time
   *
   * @example
   * expect(loan.createdAt).toBeWithinSeconds(new Date(), 5)
   */
  toBeWithinSeconds(
    received: Date,
    expected: Date,
    seconds: number = 5
  ): jest.CustomMatcherResult {
    const diff = Math.abs(received.getTime() - expected.getTime())
    const pass = diff < seconds * 1000

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} NOT to be within ${seconds}s of ${expected} (diff: ${diff}ms)`
          : `expected ${received} to be within ${seconds}s of ${expected} (diff: ${diff}ms)`,
    }
  },

  /**
   * Checks if a date is recent (within the last N seconds)
   * Useful for verifying timestamps are set correctly
   *
   * @example
   * expect(signature.signedAt).toBeRecentDate(60)
   */
  toBeRecentDate(
    received: Date,
    maxAgeSeconds: number = 60
  ): jest.CustomMatcherResult {
    const now = Date.now()
    const diff = now - received.getTime()
    const pass = diff < maxAgeSeconds * 1000 && diff >= 0

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} NOT to be recent (within ${maxAgeSeconds}s)`
          : `expected ${received} to be recent (within ${maxAgeSeconds}s), was ${diff}ms ago`,
    }
  },

  /**
   * Checks if a date is at the start of a day in UTC (midnight)
   * Useful for validating date-only fields
   *
   * @example
   * expect(listing.publishedFrom).toBeStartOfDayUTC()
   */
  toBeStartOfDayUTC(received: Date): jest.CustomMatcherResult {
    const pass =
      received.getUTCHours() === 0 &&
      received.getUTCMinutes() === 0 &&
      received.getUTCSeconds() === 0 &&
      received.getUTCMilliseconds() === 0

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} NOT to be start of day UTC`
          : `expected ${received} to be start of day UTC (00:00:00.000)`,
    }
  },

  /**
   * Checks if two dates are within a specified tolerance in milliseconds
   * More precise version of toBeWithinSeconds
   *
   * @example
   * expect(key.createdAt).toBeNearDate(new Date(), 100)
   */
  toBeNearDate(
    received: Date,
    expected: Date,
    toleranceMs: number = 100
  ): jest.CustomMatcherResult {
    const diff = Math.abs(received.getTime() - expected.getTime())
    const pass = diff < toleranceMs

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} NOT to be near ${expected} (within ${toleranceMs}ms), diff: ${diff}ms`
          : `expected ${received} to be near ${expected} (within ${toleranceMs}ms), diff: ${diff}ms`,
    }
  },
})

export {}
