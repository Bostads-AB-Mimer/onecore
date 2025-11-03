import * as logsAdapter from '../../adapters/logs-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for logs-adapter
 * Tests actual database operations with transaction rollback
 */
describe('logs-adapter', () => {
  describe('createLog', () => {
    it('inserts a log in the database', () =>
      withContext(async (ctx) => {
        const { id: _id, ...logDataWithoutId } = factory.log.build({
          userName: 'testuser@example.com',
          description: 'Test log entry',
        })

        const log = await logsAdapter.createLog(logDataWithoutId, ctx.db)

        expect(log.id).toBeDefined()
        expect(log.userName).toEqual('testuser@example.com')
        expect(log.eventType).toEqual('creation')
      }))

    it('creates log with all optional fields', () =>
      withContext(async (ctx) => {
        const { id: _id, ...logDataWithoutId } = factory.log.build({
          userName: 'admin@example.com',
          eventType: 'update' as any,
          objectType: 'key_loan' as any,
          description: 'Updated key loan status',
        })

        const log = await logsAdapter.createLog(logDataWithoutId, ctx.db)

        expect(log).toMatchObject({
          userName: 'admin@example.com',
          eventType: 'update',
          objectType: 'key_loan',
        })
      }))
  })

  describe('getLogById', () => {
    it('returns log by id', () =>
      withContext(async (ctx) => {
        const { id: _id, ...logData } = factory.log.build({
          userName: 'user1@example.com',
        })
        const created = await logsAdapter.createLog(logData, ctx.db)

        const retrieved = await logsAdapter.getLogById(created.id, ctx.db)

        expect(retrieved).toBeDefined()
        expect(retrieved?.id).toEqual(created.id)
        expect(retrieved?.userName).toEqual('user1@example.com')
      }))

    it('returns undefined when log not found', () =>
      withContext(async (ctx) => {
        const retrieved = await logsAdapter.getLogById(
          '00000000-0000-0000-0000-999999999999', // Valid UUID format
          ctx.db
        )

        expect(retrieved).toBeUndefined()
      }))
  })

  describe('getLogsByObjectId', () => {
    it('returns all logs for a specific objectId ordered by eventTime desc', () =>
      withContext(async (ctx) => {
        const objectId = '11111111-1111-1111-1111-111111111111'

        // Create multiple logs for same objectId at different times
        const { id: _id1, ...log1Data } = factory.log.build({
          objectId,
          eventType: 'creation' as any,
          eventTime: new Date('2024-01-01'),
        })
        await logsAdapter.createLog(log1Data, ctx.db)

        const { id: _id2, ...log2Data } = factory.log.build({
          objectId,
          eventType: 'update' as any,
          eventTime: new Date('2024-01-02'),
        })
        await logsAdapter.createLog(log2Data, ctx.db)

        const { id: _id3, ...log3Data } = factory.log.build({
          objectId,
          eventType: 'delete' as any,
          eventTime: new Date('2024-01-03'),
        })
        await logsAdapter.createLog(log3Data, ctx.db)

        const logs = await logsAdapter.getLogsByObjectId(objectId, ctx.db)

        expect(logs).toHaveLength(3)
        // Should be ordered by eventTime desc (most recent first)
        expect(logs[0].eventType).toEqual('delete')
        expect(logs[1].eventType).toEqual('update')
        expect(logs[2].eventType).toEqual('creation')
      }))

    it('returns empty array when no logs exist for objectId', () =>
      withContext(async (ctx) => {
        const logs = await logsAdapter.getLogsByObjectId(
          '00000000-0000-0000-0000-999999999999', // Valid UUID format
          ctx.db
        )

        expect(logs).toEqual([])
      }))
  })

  describe('getAllLogsQuery', () => {
    it('returns most recent log per objectId', () =>
      withContext(async (ctx) => {
        const objectId1 = '22222222-2222-2222-2222-222222222222'
        const objectId2 = '33333333-3333-3333-3333-333333333333'

        // Create multiple logs for object-1
        const { id: _id1, ...log1Data } = factory.log.build({
          objectId: objectId1,
          eventType: 'creation' as any,
          eventTime: new Date('2024-01-01'),
        })
        await logsAdapter.createLog(log1Data, ctx.db)

        const { id: _id2, ...log2Data } = factory.log.build({
          objectId: objectId1,
          eventType: 'update' as any,
          eventTime: new Date('2024-01-02'),
        })
        await logsAdapter.createLog(log2Data, ctx.db)

        // Create log for object-2
        const { id: _id3, ...log3Data } = factory.log.build({
          objectId: objectId2,
          eventType: 'creation' as any,
          eventTime: new Date('2024-01-01'),
        })
        await logsAdapter.createLog(log3Data, ctx.db)

        const query = logsAdapter.getAllLogsQuery(ctx.db)
        const logs = await query

        // Should return only most recent per objectId
        expect(logs).toHaveLength(2)

        const object1Log = logs.find((l: any) => l.objectId === objectId1)
        expect(object1Log.eventType).toEqual('update') // Most recent
      }))
  })

  describe('getLogsSearchQuery', () => {
    it('returns query builder for search with most recent per objectId logic', () =>
      withContext(async (ctx) => {
        const objectId = '44444444-4444-4444-4444-444444444444'

        const { id: _id1, ...log1Data } = factory.log.build({
          objectId,
          eventType: 'creation' as any,
          eventTime: new Date('2024-01-01'),
        })
        await logsAdapter.createLog(log1Data, ctx.db)

        const { id: _id2, ...log2Data } = factory.log.build({
          objectId,
          eventType: 'update' as any,
          eventTime: new Date('2024-01-02'),
        })
        await logsAdapter.createLog(log2Data, ctx.db)

        const query = logsAdapter.getLogsSearchQuery(ctx.db)
        const logs = await query

        // Should only return most recent per objectId
        const matchingLogs = logs.filter((l: any) => l.objectId === objectId)
        expect(matchingLogs).toHaveLength(1)
        expect(matchingLogs[0].eventType).toEqual('update')
      }))
  })

  // Phase 3: Improved tests for edge cases and complex scenarios
  describe('ROW_NUMBER window function edge cases', () => {
    it('handles logs with identical eventTime correctly', () =>
      withContext(async (ctx) => {
        const objectId = '55555555-5555-5555-5555-555555555555'
        const sameTime = new Date('2024-01-01T10:00:00Z')

        // Create multiple logs with exact same eventTime
        const { id: _id1, ...log1Data } = factory.log.build({
          objectId,
          eventType: 'creation' as any,
          eventTime: sameTime,
          description: 'First',
        })
        await logsAdapter.createLog(log1Data, ctx.db)

        const { id: _id2, ...log2Data } = factory.log.build({
          objectId,
          eventType: 'update' as any,
          eventTime: sameTime,
          description: 'Second',
        })
        await logsAdapter.createLog(log2Data, ctx.db)

        const query = logsAdapter.getAllLogsQuery(ctx.db)
        const logs = await query

        const matchingLogs = logs.filter((l: any) => l.objectId === objectId)
        // Should return exactly 1 log (ROW_NUMBER picks one)
        expect(matchingLogs).toHaveLength(1)
      }))

    it('excludes logs with NULL objectId from results', () =>
      withContext(async (ctx) => {
        // Create log with NULL objectId
        const { id: _id1, ...log1Data } = factory.log.build({
          objectId: null as any,
          eventType: 'creation' as any,
          description: 'System log without object',
        })
        await logsAdapter.createLog(log1Data, ctx.db)

        // Create log with valid objectId
        const objectId = '66666666-6666-6666-6666-666666666666'
        const { id: _id2, ...log2Data } = factory.log.build({
          objectId,
          eventType: 'creation' as any,
        })
        await logsAdapter.createLog(log2Data, ctx.db)

        const query = logsAdapter.getAllLogsQuery(ctx.db)
        const logs = await query

        // Should not include NULL objectId logs
        const nullLogs = logs.filter((l: any) => l.objectId === null)
        expect(nullLogs).toHaveLength(0)

        // Should include valid objectId logs
        const validLogs = logs.filter((l: any) => l.objectId === objectId)
        expect(validLogs).toHaveLength(1)
      }))

    it('handles large number of logs per objectId efficiently', () =>
      withContext(async (ctx) => {
        const objectId = '77777777-7777-7777-7777-777777777777'

        // Create 50 logs for same objectId
        const baseTime = new Date('2024-01-01T00:00:00Z')
        for (let i = 0; i < 50; i++) {
          const eventTime = new Date(baseTime.getTime() + i * 60000) // Add minutes
          const { id: _id, ...logData } = factory.log.build({
            objectId,
            eventType: 'update' as any,
            eventTime,
            description: `Log ${i}`,
          })
          await logsAdapter.createLog(logData, ctx.db)
        }

        const query = logsAdapter.getAllLogsQuery(ctx.db)
        const logs = await query

        const matchingLogs = logs.filter((l: any) => l.objectId === objectId)
        // Should return only 1 (most recent)
        expect(matchingLogs).toHaveLength(1)
        expect(matchingLogs[0].description).toBe('Log 49')
      }))
  })

  describe('pagination with mixed objectId scenarios', () => {
    it('correctly orders logs from different objects by eventTime', () =>
      withContext(async (ctx) => {
        const objectId1 = '88888888-8888-8888-8888-888888888888'
        const objectId2 = '99999999-9999-9999-9999-999999999999'

        // Object 1: most recent at 2024-01-05
        const { id: _id1, ...log1Data } = factory.log.build({
          objectId: objectId1,
          eventTime: new Date('2024-01-05'),
          eventType: 'update' as any,
        })
        await logsAdapter.createLog(log1Data, ctx.db)

        // Object 2: most recent at 2024-01-10 (newer)
        const { id: _id2, ...log2Data } = factory.log.build({
          objectId: objectId2,
          eventTime: new Date('2024-01-10'),
          eventType: 'creation' as any,
        })
        await logsAdapter.createLog(log2Data, ctx.db)

        const query = logsAdapter.getAllLogsQuery(ctx.db)
        const logs = await query

        // Results should be ordered by eventTime desc
        const relevantLogs = logs.filter(
          (l: any) => l.objectId === objectId1 || l.objectId === objectId2
        )

        expect(relevantLogs[0].objectId).toBe(objectId2) // Newer
        expect(relevantLogs[1].objectId).toBe(objectId1) // Older
      }))

    it('handles empty result set gracefully', () =>
      withContext(async (ctx) => {
        const query = logsAdapter.getAllLogsQuery(ctx.db)
        const logs = await query

        // Should return empty array, not throw error
        expect(Array.isArray(logs)).toBe(true)
      }))
  })

  describe('search query builder complex scenarios', () => {
    it('search query can be further filtered after construction', () =>
      withContext(async (ctx) => {
        const objectId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        const objectId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

        const { id: _id1, ...log1Data } = factory.log.build({
          objectId: objectId1,
          objectType: 'key_loan' as any,
          eventTime: new Date('2024-01-01'),
        })
        await logsAdapter.createLog(log1Data, ctx.db)

        const { id: _id2, ...log2Data } = factory.log.build({
          objectId: objectId2,
          objectType: 'key_system' as any,
          eventTime: new Date('2024-01-02'),
        })
        await logsAdapter.createLog(log2Data, ctx.db)

        // Use query builder and add additional filters
        const query = logsAdapter.getLogsSearchQuery(ctx.db)
        const filteredLogs = await query.where('objectType', 'key_loan')

        expect(filteredLogs).toHaveLength(1)
        expect(filteredLogs[0].objectId.toLowerCase()).toBe(
          objectId1.toLowerCase()
        )
      }))
  })
})
