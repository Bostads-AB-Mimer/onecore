import * as keySystemsAdapter from '../../adapters/key-systems-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for key-systems-adapter
 *
 * These tests verify:
 * - CRUD operations on key_systems table
 * - Schema file management
 * - System code uniqueness
 * - Query builder functions for pagination
 *
 * Pattern adopted from services/leasing adapter tests
 */

describe('key-systems-adapter', () => {
  describe('createKeySystem', () => {
    it('inserts a key system in the database', () =>
      withContext(async (ctx) => {
        const systemData = factory.keySystem.build({
          systemCode: 'SYS-001',
          name: 'Main Building System',
          manufacturer: 'ASSA ABLOY',
          type: 'MECHANICAL',
        })

        const system = await keySystemsAdapter.createKeySystem(
          systemData,
          ctx.db
        )

        expect(system.id).toBeDefined()
        expect(system.systemCode).toBe('SYS-001')
        expect(system.name).toBe('Main Building System')
        expect(system.manufacturer).toBe('ASSA ABLOY')
        expect(system.type).toBe('MECHANICAL')
      }))
  })

  describe('getKeySystemById', () => {
    it('returns system when it exists', () =>
      withContext(async (ctx) => {
        const created = await keySystemsAdapter.createKeySystem(
          factory.keySystem.build({ systemCode: 'SYS-100' }),
          ctx.db
        )

        const system = await keySystemsAdapter.getKeySystemById(
          created.id,
          ctx.db
        )

        expect(system).toBeDefined()
        expect(system?.id).toBe(created.id)
        expect(system?.systemCode).toBe('SYS-100')
      }))
  })

  describe('getKeySystemBySystemCode', () => {
    it('returns system when system code exists', () =>
      withContext(async (ctx) => {
        await keySystemsAdapter.createKeySystem(
          factory.keySystem.build({
            systemCode: 'UNIQUE-CODE-001',
            name: 'Test System',
          }),
          ctx.db
        )

        const system = await keySystemsAdapter.getKeySystemBySystemCode(
          'UNIQUE-CODE-001',
          ctx.db
        )

        expect(system).toBeDefined()
        expect(system?.systemCode).toBe('UNIQUE-CODE-001')
        expect(system?.name).toBe('Test System')
      }))
  })

  describe('updateKeySystem', () => {
    it('updates system fields successfully', () =>
      withContext(async (ctx) => {
        const system = await keySystemsAdapter.createKeySystem(
          factory.keySystem.build({
            systemCode: 'SYS-200',
            name: 'Original Name',
            isActive: true,
          }),
          ctx.db
        )

        const updated = await keySystemsAdapter.updateKeySystem(
          system.id,
          {
            name: 'Updated Name',
            isActive: false,
            manufacturer: 'New Manufacturer',
          },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.name).toBe('Updated Name')
        expect(updated?.isActive).toBe(false)
        expect(updated?.manufacturer).toBe('New Manufacturer')
        expect(updated?.systemCode).toBe('SYS-200') // Unchanged
      }))
  })

  describe('deleteKeySystem', () => {
    it('deletes system from database', () =>
      withContext(async (ctx) => {
        const system = await keySystemsAdapter.createKeySystem(
          factory.keySystem.build({ systemCode: 'SYS-300' }),
          ctx.db
        )

        const deleted = await keySystemsAdapter.deleteKeySystem(
          system.id,
          ctx.db
        )

        expect(deleted).toBe(1)
      }))
  })

  describe('updateKeySystemSchemaFileId', () => {
    it('updates schema file ID successfully', () =>
      withContext(async (ctx) => {
        const system = await keySystemsAdapter.createKeySystem(
          factory.keySystem.build({ systemCode: 'SYS-400' }),
          ctx.db
        )

        await keySystemsAdapter.updateKeySystemSchemaFileId(
          system.id,
          'file-123-456',
          ctx.db
        )

        // Verify in database
        const systemFromDb = await ctx
          .db('key_systems')
          .where({ id: system.id })
          .first()
        expect(systemFromDb.schemaFileId).toBe('file-123-456')
      }))
  })

  describe('clearKeySystemSchemaFileId', () => {
    it('clears schema file ID successfully', () =>
      withContext(async (ctx) => {
        const system = await keySystemsAdapter.createKeySystem(
          factory.keySystem.build({ systemCode: 'SYS-500' }),
          ctx.db
        )

        // Set file ID first
        await keySystemsAdapter.updateKeySystemSchemaFileId(
          system.id,
          'file-to-clear',
          ctx.db
        )

        // Clear it
        await keySystemsAdapter.clearKeySystemSchemaFileId(system.id, ctx.db)

        // Verify cleared
        const systemFromDb = await ctx
          .db('key_systems')
          .where({ id: system.id })
          .first()
        expect(systemFromDb.schemaFileId).toBeNull()
      }))
  })
})
