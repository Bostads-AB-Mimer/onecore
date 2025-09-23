import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'

const TABLE = 'key_loans'



/**
 * @swagger
 * tags:
 *   - name: Key Loans
 *     description: Endpoints related to key loan operations
 */
export const routes = (router: KoaRouter) => {
   /**
   * @swagger
   * /key-loans:
   *   get:
   *     summary: List all key loans
   *     description: Fetches a list of all key loans ordered by creation date.
   *     tags: [Key Loans]
   *     responses:
   *       200:
   *         description: A list of key loans.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: The unique ID of the key loan.
   *                       keys:
   *                         type: string
   *                         description: JSON string array of key IDs.
   *                       contact:
   *                         type: string
   *                         description: Contact information.
   *                       lease:
   *                         type: string
   *                         description: Lease identifier.
   *                       returned_at:
   *                         type: string
   *                         format: date-time
   *                         description: When keys were returned.
   *                       available_to_next_tenant_from:
   *                         type: string
   *                         format: date-time
   *                         description: When keys become available for next tenant if early return.
   *                       picked_up_at:
   *                         type: string
   *                         format: date-time
   *                         description: When keys were picked up.
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         description: When the record was created.
   *                       updated_at:
   *                         type: string
   *                         format: date-time
   *                         description: When the record was last updated.
   *                       created_by:
   *                         type: string
   *                         description: Who created this record.
   *                       updated_by:
   *                         type: string
   *                         description: Who last updated this record.
   *       500:
   *         description: An error occurred while listing key loans.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('created_at', 'desc')
      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

 /**
   * @swagger
   * /key-loans/{id}:
   *   get:
   *     summary: Get key loan by ID
   *     description: Fetch a specific key loan by its ID.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key loan to retrieve.
   *     responses:
   *       200:
   *         description: A key loan object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: The unique ID of the key loan.
   *                     keys:
   *                       type: string
   *                       description: JSON string array of key IDs.
   *                     contact:
   *                       type: string
   *                       description: Contact information.
   *                     lease:
   *                       type: string
   *                       description: Lease identifier.
   *                     returned_at:
   *                       type: string
   *                       format: date-time
   *                       description: When keys were returned.
   *                     available_to_next_tenant_from:
   *                       type: string
   *                       format: date-time
   *                       description: When keys become available for next tenant.
   *                     picked_up_at:
   *                       type: string
   *                       format: date-time
   *                       description: When keys were picked up.
   *                     created_at:
   *                       type: string
   *                       format: date-time
   *                       description: When the record was created.
   *                     updated_at:
   *                       type: string
   *                       format: date-time
   *                       description: When the record was last updated.
   *                     created_by:
   *                       type: string
   *                       description: Who created this record.
   *                     updated_by:
   *                       type: string
   *                       description: Who last updated this record.
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key loan with provided id not found
   *       500:
   *         description: An error occurred while fetching the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: `Key loan with id ${ctx.params.id} not found`, ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key loan by id')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans:
   *   post:
   *     summary: Create a new key loan
   *     description: Create a new key loan record.
   *     tags: [Key Loans]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               keys:
   *                 type: string
   *                 description: JSON string array of key IDs.
   *                 example: "[1, 2, 3]"
   *               contact:
   *                 type: string
   *                 description: Contact information (email, phone, etc.).
   *                 example: "john.doe@email.com"
   *               lease:
   *                 type: string
   *                 description: Lease identifier or reference.
   *                 example: "LEASE-2025-001"
   *               picked_up_at:
   *                 type: string
   *                 format: date-time
   *                 description: When keys were picked up.
   *                 example: "2025-09-19T14:30:00.000Z"
   *               available_to_next_tenant_from:
   *                 type: string
   *                 format: date-time
   *                 description: When keys become available for next tenant.
   *                 example: "2025-12-01T00:00:00.000Z"
   *               created_by:
   *                 type: string
   *                 description: Who created this record.
   *                 example: "admin-user-123"
   *     responses:
   *       201:
   *         description: Key loan created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: The created key loan object.
   *       500:
   *         description: An error occurred while creating the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.post('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}

      const [row] = await db(TABLE).insert(payload).returning('*')
      ctx.status = 201
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error creating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   patch:
   *     summary: Update a key loan
   *     description: Partially update an existing key loan.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key loan to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               keys:
   *                 type: string
   *                 description: JSON string array of key IDs.
   *                 example: "[1, 2]"
   *               contact:
   *                 type: string
   *                 description: Contact information.
   *                 example: "updated.email@email.com"
   *               lease:
   *                 type: string
   *                 description: Lease identifier.
   *                 example: "LEASE-2025-002"
   *               returned_at:
   *                 type: string
   *                 format: date-time
   *                 description: When keys were returned.
   *                 example: "2025-09-19T16:00:00.000Z"
   *               available_to_next_tenant_from:
   *                 type: string
   *                 format: date-time
   *                 description: When keys become available for next tenant.
   *               picked_up_at:
   *                 type: string
   *                 format: date-time
   *                 description: When keys were picked up.
   *               updated_by:
   *                 type: string
   *                 description: Who updated this record.
   *                 example: "admin-user-456"
   *     responses:
   *       200:
   *         description: Key loan updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: The updated key loan object.
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key loan with id 12345678-1234-1234-1234-123456789abc not found
   *       500:
   *         description: An error occurred while updating the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.patch('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}

      const [row] = await db(TABLE)
        .where({ id: ctx.params.id })
        .update({ ...payload, updated_at: db.fn.now() })
        .returning('*')

      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key loan with id ' + ctx.params.id + ' not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error updating key loan with id ' + ctx.params.id)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   delete:
   *     summary: Delete a key loan
   *     description: Delete an existing key loan by ID.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key loan to delete.
   *     responses:
   *       200:
   *         description: Key loan deleted successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key loan with id 12345678-1234-1234-1234-123456789abc not found
   *       500:
   *         description: An error occurred while deleting the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.delete('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
      if (!n) {
        ctx.status = 404
        ctx.body = { reason: `Key loan with id ${ctx.params.id} not found`, ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, `Error deleting key loan with id ${ctx.params.id}`)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
