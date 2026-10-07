import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import * as keyNotesAdapter from '../adapters/key-notes-adapter'
import {
  MAX_BATCH_RENTAL_OBJECT_CODES,
  parseRentalObjectCodes,
} from '../../../utils/rental-object-codes'

const {
  KeyNoteSchema,
  CreateKeyNoteRequestSchema,
  UpdateKeyNoteRequestSchema,
} = keys
type CreateKeyNoteRequest = keys.CreateKeyNoteRequest
type UpdateKeyNoteRequest = keys.UpdateKeyNoteRequest

/**
 * @swagger
 * tags:
 *   - name: KeyNotes
 *     description: Operations for key notes
 */
export const routes = (router: KoaRouter) => {
  registerSchema('CreateKeyNoteRequest', CreateKeyNoteRequestSchema)
  registerSchema('UpdateKeyNoteRequest', UpdateKeyNoteRequestSchema)
  registerSchema('KeyNote', KeyNoteSchema)

  /**
   * @swagger
   * /key-notes/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get all key notes by rental object code
   *     description: Returns all key notes associated with a specific rental object code.
   *     tags: [KeyNotes]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to filter key notes by.
   *     responses:
   *       200:
   *         description: List of key notes for the rental object code.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyNote'
   *       500:
   *         description: An error occurred while fetching key notes.
   */
  /**
   * @swagger
   * /key-notes/batch/by-rental-object:
   *   get:
   *     summary: Get key notes for many rental objects in one call
   *     description: Returns a map keyed by rentalObjectCode; every requested code is present. Max 200 codes.
   *     tags: [KeyNotes]
   *     parameters:
   *       - in: query
   *         name: rentalObjectCodes
   *         required: true
   *         style: form
   *         explode: true
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *     responses:
   *       200:
   *         description: Key notes grouped by rental object code.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   additionalProperties:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/KeyNote'
   *       400:
   *         description: Missing or too many rental object codes.
   *       500:
   *         description: Internal server error.
   */
  router.get('/key-notes/batch/by-rental-object', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['rentalObjectCodes'])
    try {
      const codes = parseRentalObjectCodes(ctx)
      if (codes.length === 0 || codes.length > MAX_BATCH_RENTAL_OBJECT_CODES) {
        ctx.status = 400
        ctx.body = {
          reason: `rentalObjectCodes must contain 1-${MAX_BATCH_RENTAL_OBJECT_CODES} codes`,
          ...metadata,
        }
        return
      }
      const content = await keyNotesAdapter.getKeyNotesByRentalObjects(
        codes,
        db
      )
      ctx.status = 200
      ctx.body = { content, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key notes batch by rental object')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  router.get('/key-notes/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await keyNotesAdapter.getKeyNotesByRentalObject(
        ctx.params.rentalObjectCode,
        db
      )

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key notes by rental object code')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-notes/{id}:
   *   get:
   *     summary: Get key note by ID
   *     description: Fetch a specific key note by its ID.
   *     tags: [KeyNotes]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key note to retrieve.
   *     responses:
   *       200:
   *         description: A key note object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyNote'
   *       404:
   *         description: Key note not found.
   *       500:
   *         description: An error occurred while fetching the key note.
   */
  router.get('/key-notes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await keyNotesAdapter.getKeyNoteById(ctx.params.id, db)
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key note not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key note')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-notes:
   *   post:
   *     summary: Create a key note
   *     description: Create a new key note record.
   *     tags: [KeyNotes]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyNoteRequest'
   *     responses:
   *       201:
   *         description: Key note created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyNote'
   *       400:
   *         description: Invalid request body.
   *       500:
   *         description: An error occurred while creating the key note.
   */
  router.post(
    '/key-notes',
    parseRequestBody(CreateKeyNoteRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateKeyNoteRequest = ctx.request.body
        const row = await keyNotesAdapter.createKeyNote(payload, db)

        ctx.status = 201
        ctx.body = { content: row, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating key note')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-notes/{id}:
   *   put:
   *     summary: Update a key note
   *     description: Update the description of an existing key note.
   *     tags: [KeyNotes]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key note to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyNoteRequest'
   *     responses:
   *       200:
   *         description: Key note updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyNote'
   *       404:
   *         description: Key note not found.
   *       400:
   *         description: Invalid request body.
   *       500:
   *         description: An error occurred while updating the key note.
   */
  router.put(
    '/key-notes/:id',
    parseRequestBody(UpdateKeyNoteRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeyNoteRequest = ctx.request.body
        const row = await keyNotesAdapter.updateKeyNote(
          ctx.params.id,
          payload,
          db
        )

        if (!row) {
          ctx.status = 404
          ctx.body = { reason: 'Key note not found', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = { content: row, ...metadata }
      } catch (err) {
        logger.error(err, 'Error updating key note')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )
}
