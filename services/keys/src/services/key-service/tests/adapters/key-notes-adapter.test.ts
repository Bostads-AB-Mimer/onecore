import * as keyNotesAdapter from '../../adapters/key-notes-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for key-notes-adapter
 * Tests actual database operations with transaction rollback
 */
describe('key-notes-adapter', () => {
  describe('createKeyNote', () => {
    it('inserts a key note in the database', () =>
      withContext(async (ctx) => {
        const keyNoteData = factory.keyNote.build({
          rentalObjectCode: 'A001',
          description: 'Test note for rental object A001',
        })

        const keyNote = await keyNotesAdapter.createKeyNote(keyNoteData, ctx.db)

        expect(keyNote.id).toBeDefined()
        expect(keyNote.rentalObjectCode).toEqual('A001')
        expect(keyNote.description).toEqual('Test note for rental object A001')

        // Verify in database
        const keyNoteFromDb = await ctx
          .db('key_notes')
          .where({ id: keyNote.id })
          .first()
        expect(keyNoteFromDb).toBeDefined()
        expect(keyNoteFromDb.rentalObjectCode).toEqual('A001')
      }))

    it('creates multiple key notes for same rental object', () =>
      withContext(async (ctx) => {
        const rentalObjectCode = 'B002'

        const note1 = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode,
            description: 'First note',
          }),
          ctx.db
        )

        const note2 = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode,
            description: 'Second note',
          }),
          ctx.db
        )

        expect(note1.id).toBeDefined()
        expect(note2.id).toBeDefined()
        expect(note1.id).not.toEqual(note2.id)

        const notesInDb = await ctx.db('key_notes').where({ rentalObjectCode })
        expect(notesInDb).toHaveLength(2)
      }))
  })

  describe('getKeyNoteById', () => {
    it('returns key note by id', () =>
      withContext(async (ctx) => {
        const created = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode: 'C003',
            description: 'Test note',
          }),
          ctx.db
        )

        const retrieved = await keyNotesAdapter.getKeyNoteById(
          created.id,
          ctx.db
        )

        expect(retrieved).toBeDefined()
        expect(retrieved?.id).toEqual(created.id)
        expect(retrieved?.rentalObjectCode).toEqual('C003')
        expect(retrieved?.description).toEqual('Test note')
      }))

    it('returns undefined when key note not found', () =>
      withContext(async (ctx) => {
        const retrieved = await keyNotesAdapter.getKeyNoteById(
          '00000000-0000-0000-0000-999999999999', // Valid UUID format
          ctx.db
        )

        expect(retrieved).toBeUndefined()
      }))
  })

  describe('getKeyNotesByRentalObject', () => {
    it('returns all key notes for a rental object ordered by id desc', () =>
      withContext(async (ctx) => {
        const rentalObjectCode = 'D004'

        // Create multiple notes
        const note1 = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode,
            description: 'First note',
          }),
          ctx.db
        )

        const note2 = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode,
            description: 'Second note',
          }),
          ctx.db
        )

        const note3 = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode,
            description: 'Third note',
          }),
          ctx.db
        )

        const keyNotes = await keyNotesAdapter.getKeyNotesByRentalObject(
          rentalObjectCode,
          ctx.db
        )

        expect(keyNotes).toHaveLength(3)
        // Should be ordered by id desc (most recent first)
        expect(keyNotes[0].id).toEqual(note3.id)
        expect(keyNotes[1].id).toEqual(note2.id)
        expect(keyNotes[2].id).toEqual(note1.id)
      }))

    it('returns empty array when no key notes exist for rental object', () =>
      withContext(async (ctx) => {
        const keyNotes = await keyNotesAdapter.getKeyNotesByRentalObject(
          'NON_EXISTENT',
          ctx.db
        )

        expect(keyNotes).toEqual([])
      }))

    it('returns only notes for specified rental object', () =>
      withContext(async (ctx) => {
        // Create notes for different rental objects
        await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode: 'E005',
            description: 'Note for E005',
          }),
          ctx.db
        )

        await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode: 'F006',
            description: 'Note for F006',
          }),
          ctx.db
        )

        const keyNotes = await keyNotesAdapter.getKeyNotesByRentalObject(
          'E005',
          ctx.db
        )

        expect(keyNotes).toHaveLength(1)
        expect(keyNotes[0].rentalObjectCode).toEqual('E005')
      }))
  })

  describe('updateKeyNote', () => {
    it('updates key note description', () =>
      withContext(async (ctx) => {
        const created = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode: 'G007',
            description: 'Original description',
          }),
          ctx.db
        )

        const updated = await keyNotesAdapter.updateKeyNote(
          created.id,
          { description: 'Updated description' },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.id).toEqual(created.id)
        expect(updated?.description).toEqual('Updated description')
        expect(updated?.rentalObjectCode).toEqual('G007') // Should not change

        // Verify in database
        const keyNoteFromDb = await ctx
          .db('key_notes')
          .where({ id: created.id })
          .first()
        expect(keyNoteFromDb.description).toEqual('Updated description')
      }))

    it('returns undefined when key note not found', () =>
      withContext(async (ctx) => {
        const updated = await keyNotesAdapter.updateKeyNote(
          '00000000-0000-0000-0000-999999999999', // Valid UUID format
          { description: 'New description' },
          ctx.db
        )

        expect(updated).toBeUndefined()
      }))

    it('updates only specified fields (partial update)', () =>
      withContext(async (ctx) => {
        const created = await keyNotesAdapter.createKeyNote(
          factory.keyNote.build({
            rentalObjectCode: 'H008',
            description: 'Original description',
          }),
          ctx.db
        )

        const updated = await keyNotesAdapter.updateKeyNote(
          created.id,
          { description: 'Partially updated' },
          ctx.db
        )

        expect(updated?.rentalObjectCode).toEqual('H008') // Unchanged
        expect(updated?.description).toEqual('Partially updated') // Changed
      }))
  })
})
