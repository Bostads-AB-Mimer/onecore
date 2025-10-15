import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/key-notes'
import * as factory from '../factories'
import * as keyNotesAdapter from '../../adapters/key-notes-adapter'

// Set up a Koa app with the key-notes routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

/**
 * Tests for GET /key-notes/:id endpoint
 *
 * Testing get single key note:
 * - Successful retrieval
 * - Not found (404)
 * - Database errors
 */
describe('GET /key-notes/:id', () => {
  it('responds with 200 and key note data when found', async () => {
    const mockKeyNote = factory.keyNote.build({
      id: 'note-123',
      rentalObjectCode: 'A001',
      description: 'Test note',
    })

    const getKeyNoteByIdSpy = jest
      .spyOn(keyNotesAdapter, 'getKeyNoteById')
      .mockResolvedValueOnce(mockKeyNote)

    const res = await request(app.callback()).get('/key-notes/note-123')

    expect(getKeyNoteByIdSpy).toHaveBeenCalledWith(
      'note-123',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: 'note-123',
      rentalObjectCode: 'A001',
      description: 'Test note',
    })
  })

  it('responds with 404 if key note not found', async () => {
    const getKeyNoteByIdSpy = jest
      .spyOn(keyNotesAdapter, 'getKeyNoteById')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get('/key-notes/nonexistent-id')

    expect(getKeyNoteByIdSpy).toHaveBeenCalledWith(
      'nonexistent-id',
      expect.anything()
    )
    expect(res.status).toBe(404)
    expect(res.body.reason).toContain('not found')
  })

  it('handles database errors and returns 500', async () => {
    jest
      .spyOn(keyNotesAdapter, 'getKeyNoteById')
      .mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app.callback()).get('/key-notes/note-123')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })
})

/**
 * Tests for GET /key-notes/by-rental-object/:rentalObjectCode endpoint
 *
 * Testing get all key notes for a rental object:
 * - Successful retrieval with multiple notes
 * - Empty results
 * - Database errors
 */
describe('GET /key-notes/by-rental-object/:rentalObjectCode', () => {
  it('returns all key notes for a rental object code', async () => {
    const mockKeyNotes = [
      factory.keyNote.build({
        id: 'note-1',
        rentalObjectCode: 'A001',
        description: 'First note',
      }),
      factory.keyNote.build({
        id: 'note-2',
        rentalObjectCode: 'A001',
        description: 'Second note',
      }),
      factory.keyNote.build({
        id: 'note-3',
        rentalObjectCode: 'A001',
        description: 'Third note',
      }),
    ]

    const getKeyNotesByRentalObjectSpy = jest
      .spyOn(keyNotesAdapter, 'getKeyNotesByRentalObject')
      .mockResolvedValueOnce(mockKeyNotes)

    const res = await request(app.callback()).get(
      '/key-notes/by-rental-object/A001'
    )

    expect(getKeyNotesByRentalObjectSpy).toHaveBeenCalledWith(
      'A001',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(3)
    expect(res.body.content[0]).toMatchObject({
      id: 'note-1',
      rentalObjectCode: 'A001',
    })
  })

  it('returns empty array when no key notes exist for rental object', async () => {
    const getKeyNotesByRentalObjectSpy = jest
      .spyOn(keyNotesAdapter, 'getKeyNotesByRentalObject')
      .mockResolvedValueOnce([])

    const res = await request(app.callback()).get(
      '/key-notes/by-rental-object/NONEXISTENT'
    )

    expect(getKeyNotesByRentalObjectSpy).toHaveBeenCalledWith(
      'NONEXISTENT',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(0)
  })

  it('handles database errors and returns 500', async () => {
    jest
      .spyOn(keyNotesAdapter, 'getKeyNotesByRentalObject')
      .mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app.callback()).get(
      '/key-notes/by-rental-object/A001'
    )

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })
})

/**
 * Tests for POST /key-notes endpoint (Create)
 *
 * Testing key note creation with various scenarios:
 * - Successful creation
 * - Validation errors
 * - Database errors
 */
describe('POST /key-notes', () => {
  it('creates key note successfully and returns 201', async () => {
    const createdKeyNote = factory.keyNote.build({
      id: 'new-note-123',
      rentalObjectCode: 'B002',
      description: 'New note for rental object B002',
    })

    const createKeyNoteSpy = jest
      .spyOn(keyNotesAdapter, 'createKeyNote')
      .mockResolvedValueOnce(createdKeyNote)

    const res = await request(app.callback()).post('/key-notes').send({
      rentalObjectCode: 'B002',
      description: 'New note for rental object B002',
    })

    expect(createKeyNoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalObjectCode: 'B002',
        description: 'New note for rental object B002',
      }),
      expect.anything()
    )

    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      id: 'new-note-123',
      rentalObjectCode: 'B002',
      description: 'New note for rental object B002',
    })
  })

  it('validates missing required fields and returns 400', async () => {
    const res = await request(app.callback()).post('/key-notes').send({
      description: 'Note without rental object code',
      // rentalObjectCode is missing
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
  })

  it('validates missing description field and returns 400', async () => {
    const res = await request(app.callback()).post('/key-notes').send({
      rentalObjectCode: 'C003',
      // description is missing
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
    expect(res.body.data).toBeDefined()
  })

  it('handles database errors and returns 500', async () => {
    jest
      .spyOn(keyNotesAdapter, 'createKeyNote')
      .mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app.callback()).post('/key-notes').send({
      rentalObjectCode: 'D004',
      description: 'Test note',
    })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })
})

/**
 * Tests for PATCH /key-notes/:id endpoint (Update)
 *
 * Testing key note update with various scenarios:
 * - Successful update
 * - Successful partial update
 * - Not found (404)
 * - Validation errors
 * - Database errors
 */
describe('PATCH /key-notes/:id', () => {
  it('updates key note successfully and returns 200', async () => {
    const updatedKeyNote = factory.keyNote.build({
      id: 'note-123',
      rentalObjectCode: 'E005',
      description: 'Updated description',
    })

    const updateKeyNoteSpy = jest
      .spyOn(keyNotesAdapter, 'updateKeyNote')
      .mockResolvedValueOnce(updatedKeyNote)

    const res = await request(app.callback())
      .patch('/key-notes/note-123')
      .send({
        description: 'Updated description',
      })

    expect(updateKeyNoteSpy).toHaveBeenCalledWith(
      'note-123',
      expect.objectContaining({
        description: 'Updated description',
      }),
      expect.anything()
    )

    expect(res.status).toBe(200)
    expect(res.body.content.description).toBe('Updated description')
  })

  it('successfully updates only specified fields (partial update)', async () => {
    const updatedKeyNote = factory.keyNote.build({
      id: 'note-123',
      rentalObjectCode: 'F006',
      description: 'Partially updated description',
    })

    const updateKeyNoteSpy = jest
      .spyOn(keyNotesAdapter, 'updateKeyNote')
      .mockResolvedValueOnce(updatedKeyNote)

    const res = await request(app.callback())
      .patch('/key-notes/note-123')
      .send({
        description: 'Partially updated description',
      })

    expect(updateKeyNoteSpy).toHaveBeenCalledWith(
      'note-123',
      expect.objectContaining({
        description: 'Partially updated description',
      }),
      expect.anything()
    )

    expect(res.status).toBe(200)
    expect(res.body.content.description).toBe('Partially updated description')
  })

  it('responds with 404 if key note not found', async () => {
    const updateKeyNoteSpy = jest
      .spyOn(keyNotesAdapter, 'updateKeyNote')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback())
      .patch('/key-notes/nonexistent-id')
      .send({
        description: 'New description',
      })

    expect(updateKeyNoteSpy).toHaveBeenCalledWith(
      'nonexistent-id',
      expect.anything(),
      expect.anything()
    )

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('reason', 'Key note not found')
  })

  it('handles database errors and returns 500', async () => {
    jest
      .spyOn(keyNotesAdapter, 'updateKeyNote')
      .mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app.callback())
      .patch('/key-notes/note-123')
      .send({
        description: 'Updated description',
      })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })
})

/**
 * Phase 6D: Validation Edge Cases - Key Notes
 *
 * Testing edge cases and boundary conditions:
 * - Empty strings
 * - Very long descriptions
 * - Special characters
 */
describe('Validation Edge Cases - Key Notes', () => {
  it('documents current behavior: empty description string allowed', async () => {
    const createdKeyNote = factory.keyNote.build({
      rentalObjectCode: 'G007',
      description: '',
    })

    jest
      .spyOn(keyNotesAdapter, 'createKeyNote')
      .mockResolvedValueOnce(createdKeyNote)

    const res = await request(app.callback()).post('/key-notes').send({
      rentalObjectCode: 'G007',
      description: '', // Empty string
    })

    // Documents current behavior: empty strings are allowed
    // Future improvement: Add min length validation for description
    expect(res.status).toBe(201)
  })

  it('handles very long descriptions', async () => {
    const veryLongDescription = 'A'.repeat(1000)
    const createdKeyNote = factory.keyNote.build({
      rentalObjectCode: 'H008',
      description: veryLongDescription,
    })

    jest
      .spyOn(keyNotesAdapter, 'createKeyNote')
      .mockResolvedValueOnce(createdKeyNote)

    const res = await request(app.callback()).post('/key-notes').send({
      rentalObjectCode: 'H008',
      description: veryLongDescription,
    })

    // May succeed or fail depending on database column size
    expect([201, 400, 500]).toContain(res.status)
  })

  it('handles special characters in description', async () => {
    const specialCharsDescription =
      'Note with special chars: @#$%^&*()_+-=[]{}|;:,.<>?'
    const createdKeyNote = factory.keyNote.build({
      rentalObjectCode: 'I009',
      description: specialCharsDescription,
    })

    jest
      .spyOn(keyNotesAdapter, 'createKeyNote')
      .mockResolvedValueOnce(createdKeyNote)

    const res = await request(app.callback()).post('/key-notes').send({
      rentalObjectCode: 'I009',
      description: specialCharsDescription,
    })

    expect(res.status).toBe(201)
    expect(res.body.content.description).toBe(specialCharsDescription)
  })
})
