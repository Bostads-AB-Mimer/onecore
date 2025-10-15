import { withContext } from './testUtils'

/**
 * Basic test to validate test infrastructure is working correctly.
 * This test ensures:
 * - Database connection works
 * - Migrations have been applied
 * - withContext transaction pattern works
 * - Test environment is properly configured
 */
describe('Test Infrastructure', () => {
  it('connects to test database successfully', () =>
    withContext(async (ctx) => {
      // Simple query to verify database connectivity
      const result = await ctx.db.raw('SELECT 1 as value')
      expect(result[0].value).toBe(1)
    }))

  it('has migrations applied', () =>
    withContext(async (ctx) => {
      // Verify that the migrations have created our tables
      const tables = await ctx.db.raw(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME IN ('keys', 'key_loans', 'key_systems', 'key_notes', 'receipts', 'logs')
      `)

      // Should have at least our main tables
      expect(tables.length).toBeGreaterThan(0)

      const tableNames = tables.map((t: any) => t.TABLE_NAME)
      expect(tableNames).toContain('keys')
      expect(tableNames).toContain('key_loans')
      expect(tableNames).toContain('key_systems')
    }))

  it('withContext rolls back transactions', () =>
    withContext(async (ctx) => {
      // Insert a test record
      const [inserted] = await ctx
        .db('keys')
        .insert({
          keyName: 'TEST_KEY_SHOULD_BE_ROLLED_BACK',
          keyType: 'test',
          rentalObjectCode: 'TEST001',
        })
        .returning('*')

      expect(inserted.keyName).toBe('TEST_KEY_SHOULD_BE_ROLLED_BACK')

      // After this test completes, the insert should be rolled back
      // We'll verify this in the next test
    }))

  it('verifies previous test was rolled back', () =>
    withContext(async (ctx) => {
      // Check that the key inserted in the previous test does not exist
      const keys = await ctx
        .db('keys')
        .where({ keyName: 'TEST_KEY_SHOULD_BE_ROLLED_BACK' })

      expect(keys).toHaveLength(0)
    }))
})
