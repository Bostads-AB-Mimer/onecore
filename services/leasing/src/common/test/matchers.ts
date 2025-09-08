expect.extend({
  toBeSameDayAs(received, expected) {
    const pass =
      received.getFullYear() === expected.getFullYear() &&
      received.getMonth() === expected.getMonth() &&
      received.getDate() === expected.getDate()
    return {
      pass,
      message: () => `expected ${received} to be same day as ${expected}`,
    }
  },
  toBeNearDate(actual: Date, expected: Date) {
    return {
      pass: Math.abs(actual.getTime() - expected.getTime()) < 100,
      message: () =>
        `expected ${actual} and ${expected} to be less than 100ms apart`,
    }
  },
  toBeStartOfDayUTC(actual: Date) {
    const pass =
      actual.getUTCHours() === 0 &&
      actual.getUTCMinutes() === 0 &&
      actual.getUTCSeconds() === 0
    return {
      pass,
      message: () => `expected ${actual} to be start of day UTC`,
    }
  },
})

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeSameDayAs(expected: Date): R
      toBeNearDate(expected: Date): R
      toBeStartOfDayUTC(): R
    }
  }
}
