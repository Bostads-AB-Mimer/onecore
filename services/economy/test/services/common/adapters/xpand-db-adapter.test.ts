import { mapContactFlags } from '@src/services/common/adapters/xpand-db-adapter'

describe('mapContactFlags', () => {
  describe('deceased', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.deceased).toBe(false)
    })

    it('is true when db value is non-null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: '2024-01-01',
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.deceased).toBe(true)
    })
  })

  describe('emigrated', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.emigrated).toBe(false)
    })

    it('is true when db value is non-null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: '2024-01-01',
        noAdvertising: null,
      })
      expect(result.emigrated).toBe(true)
    })
  })

  describe('noAdvertising', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.noAdvertising).toBe(false)
    })

    it('is false when db value is 0', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: 0,
      })
      expect(result.noAdvertising).toBe(false)
    })

    it('is true when db value is non-zero', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: 1,
      })
      expect(result.noAdvertising).toBe(true)
    })
  })

  describe('protectedIdentity', () => {
    it('is false when db value is null', () => {
      const result = mapContactFlags({
        protectedIdentity: null,
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.protectedIdentity).toBe(false)
    })

    it('is true when db value is non-null', () => {
      const result = mapContactFlags({
        protectedIdentity: '2024-01-01',
        deceased: null,
        emigrated: null,
        noAdvertising: null,
      })
      expect(result.protectedIdentity).toBe(true)
    })
  })
})
