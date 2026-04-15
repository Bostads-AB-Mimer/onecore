import { makeHealStrategy } from '@/resource/heal-strategy'

describe('HealStrategy', () => {
  describe('fixed-interval', () => {
    describe('nextInterval', () => {
      it('should continuously return fixed interval after initialDelay', () => {
        // Given
        const strategy = makeHealStrategy({
          strategy: 'fixed-interval',
          timeUnit: 's',
          interval: 10,
        })

        // Then
        expect(strategy.nextInterval()).toEqual(1000)
        expect(strategy.nextInterval()).toEqual(10000)
        expect(strategy.nextInterval()).toEqual(10000)
        expect(strategy.nextInterval()).toEqual(10000)
        expect(strategy.nextInterval()).toEqual(10000)
      })

      it('should continuously return fixed interval after custom initialDelay', () => {
        // Given
        const strategy = makeHealStrategy({
          strategy: 'fixed-interval',
          timeUnit: 'm',
          initialDelay: 1,
          interval: 10,
        })

        // Then
        expect(strategy.nextInterval()).toEqual(60000)
        expect(strategy.nextInterval()).toEqual(600000)
        expect(strategy.nextInterval()).toEqual(600000)
        expect(strategy.nextInterval()).toEqual(600000)
        expect(strategy.nextInterval()).toEqual(600000)

        strategy.reset()

        expect(strategy.nextInterval()).toEqual(60000)
        expect(strategy.nextInterval()).toEqual(600000)
        expect(strategy.nextInterval()).toEqual(600000)
        expect(strategy.nextInterval()).toEqual(600000)
        expect(strategy.nextInterval()).toEqual(600000)
      })
    })
  })

  describe('incremental-backoff', () => {
    describe('nextInterval', () => {
      it('should return an incrementing interval after initialDelay, but not past maxInterval', () => {
        // Given
        const strategy = makeHealStrategy({
          strategy: 'incremental-backoff',
          timeUnit: 'ms',
          increment: 500,
          maxInterval: 3000,
        })

        // Then
        expect(strategy.nextInterval()).toEqual(1000)
        expect(strategy.nextInterval()).toEqual(500)
        expect(strategy.nextInterval()).toEqual(1000)
        expect(strategy.nextInterval()).toEqual(1500)
        expect(strategy.nextInterval()).toEqual(2000)
        expect(strategy.nextInterval()).toEqual(2500)
        expect(strategy.nextInterval()).toEqual(3000)
        expect(strategy.nextInterval()).toEqual(3000)
        expect(strategy.nextInterval()).toEqual(3000)
        expect(strategy.nextInterval()).toEqual(3000)

        strategy.reset()

        expect(strategy.nextInterval()).toEqual(1000)
        expect(strategy.nextInterval()).toEqual(500)
        expect(strategy.nextInterval()).toEqual(1000)
        expect(strategy.nextInterval()).toEqual(1500)
        expect(strategy.nextInterval()).toEqual(2000)
        expect(strategy.nextInterval()).toEqual(2500)
        expect(strategy.nextInterval()).toEqual(3000)
        expect(strategy.nextInterval()).toEqual(3000)
        expect(strategy.nextInterval()).toEqual(3000)
        expect(strategy.nextInterval()).toEqual(3000)
      })
    })
  })

  describe('exponential-backoff', () => {
    describe('nextInterval', () => {
      it('should return an exponentially increasing interval after initialDelay, but not past maxInterval', () => {
        // Given
        const strategy = makeHealStrategy({
          strategy: 'exponential-backoff',
          timeUnit: 'ms',
          maxInterval: 643000,
        })

        // Then
        expect(strategy.nextInterval()).toEqual(1000)
        expect(strategy.nextInterval()).toEqual(2000)
        expect(strategy.nextInterval()).toEqual(4000)
        expect(strategy.nextInterval()).toEqual(8000)
        expect(strategy.nextInterval()).toEqual(16000)
        expect(strategy.nextInterval()).toEqual(32000)
        expect(strategy.nextInterval()).toEqual(64000)
        expect(strategy.nextInterval()).toEqual(128000)
        expect(strategy.nextInterval()).toEqual(256000)
        expect(strategy.nextInterval()).toEqual(512000)
        expect(strategy.nextInterval()).toEqual(643000)
        expect(strategy.nextInterval()).toEqual(643000)

        strategy.reset()

        expect(strategy.nextInterval()).toEqual(1000)
        expect(strategy.nextInterval()).toEqual(2000)
        expect(strategy.nextInterval()).toEqual(4000)
        expect(strategy.nextInterval()).toEqual(8000)
        expect(strategy.nextInterval()).toEqual(16000)
        expect(strategy.nextInterval()).toEqual(32000)
        expect(strategy.nextInterval()).toEqual(64000)
        expect(strategy.nextInterval()).toEqual(128000)
        expect(strategy.nextInterval()).toEqual(256000)
        expect(strategy.nextInterval()).toEqual(512000)
        expect(strategy.nextInterval()).toEqual(643000)
        expect(strategy.nextInterval()).toEqual(643000)
      })
    })
  })

  describe('off', () => {
    describe('nextInterval', () => {
      it('should consistently return -1', () => {
        // Given
        const strategy = makeHealStrategy({ strategy: 'off' })

        // Then
        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)

        strategy.reset()

        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)
        expect(strategy.nextInterval()).toEqual(-1)
      })
    })
  })
})
