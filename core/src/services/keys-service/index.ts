import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeyLoansApi, KeysApi, KeySystemsApi, LogsApi } from '../../adapters/keys-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Keys Service
 *     description: Operations related to key management
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Key:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         key_name:
 *           type: string
 *         key_sequence_number:
 *           type: integer
 *         flex_number:
 *           type: integer
 *         rental_object:
 *           type: string
 *         key_type:
 *           type: string
 *           enum: [LGH, PB, FS, HN]
 *         key_system_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     KeyLoan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         keys:
 *           type: string
 *           description: JSON string array of key IDs
 *         contact:
 *           type: string
 *         lease:
 *           type: string
 *         returned_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         available_to_next_tenant_from:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         picked_up_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         created_by:
 *           type: string
 *           nullable: true
 *         updated_by:
 *           type: string
 *           nullable: true
 *     KeySystem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         system_code:
 *           type: string
 *         name:
 *           type: string
 *         manufacturer:
 *           type: string
 *         type:
 *           type: string
 *           enum: [MECHANICAL, ELECTRONIC, HYBRID]
 *         property_ids:
 *           type: string
 *         installation_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         is_active:
 *           type: boolean
 *         description:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         created_by:
 *           type: string
 *           nullable: true
 *         updated_by:
 *           type: string
 *           nullable: true
 *     Log:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_name:
 *           type: string
 *           example: "seb"
 *         event_type:
 *           type: string
 *           enum: [creation, update, delete]
 *           example: "creation"
 *         object_type:
 *           type: string
 *           enum: [key, key_system, key_loan]
 *           example: "key"
 *         event_time:
 *           type: string
 *           format: date-time
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Created key APT-1001"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Internal server error"
 *     NotFoundResponse:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           example: "Resource not found"
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  
  // ==================== KEY LOANS ROUTES ====================
  
  /**
   * @swagger
   * /key-loans:
   *   get:
   *     summary: List all key loans
   *     description: Fetches a list of all key loans ordered by creation date.
   *     tags: [Keys Service]
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
   *                     $ref: '#/components/schemas/KeyLoan'
   *       500:
   *         description: An error occurred while listing key loans.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeyLoansApi.list()
    
    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   get:
   *     summary: Get key loan by ID
   *     description: Fetch a specific key loan by its ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *                   $ref: '#/components/schemas/KeyLoan'
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while fetching the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeyLoansApi.get(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error fetching key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans:
   *   post:
   *     summary: Create a new key loan
   *     description: Create a new key loan record.
   *     tags: [Keys Service]
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
   *                   $ref: '#/components/schemas/KeyLoan'
   *       400:
   *         description: Invalid request data.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: An error occurred while creating the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await KeyLoansApi.create(payload)
    
    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error creating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   patch:
   *     summary: Update a key loan
   *     description: Partially update an existing key loan.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *                   $ref: '#/components/schemas/KeyLoan'
   *       400:
   *         description: Invalid request data.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while updating the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await KeyLoansApi.update(ctx.params.id, payload)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error updating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   delete:
   *     summary: Delete a key loan
   *     description: Delete an existing key loan by ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The unique ID of the key loan to delete.
   *     responses:
   *       200:
   *         description: Key loan deleted successfully.
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while deleting the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeyLoansApi.remove(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error deleting key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== KEYS ROUTES ====================

  /**
   * @swagger
   * /keys:
   *   get:
   *     summary: List keys
   *     description: Returns keys ordered by created_at (desc).
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: List of keys
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Key'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeysApi.list()
    
    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   get:
   *     summary: Get key by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Key found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeysApi.get(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error fetching key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys:
   *   post:
   *     summary: Create a key
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [key_name, key_type]
   *             properties:
   *               key_name:
   *                 type: string
   *                 example: "Front door A"
   *               key_sequence_number:
   *                 type: integer
   *                 example: 101
   *               flex_number:
   *                 type: integer
   *                 example: 1
   *               rental_object:
   *                 type: string
   *                 example: "APT-1001"
   *               key_type:
   *                 type: string
   *                 enum: [LGH, PB, FS, HN]
   *                 example: "LGH"
   *               key_system_id:
   *                 type: string
   *                 format: uuid
   *                 nullable: true
   *                 example: null
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       400:
   *         description: Invalid key_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await KeysApi.create(payload)
    
    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error creating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   patch:
   *     summary: Update a key (partial)
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               key_name:
   *                 type: string
   *                 example: "Front door A (updated)"
   *               key_sequence_number:
   *                 type: integer
   *               flex_number:
   *                 type: integer
   *               rental_object:
   *                 type: string
   *               key_type:
   *                 type: string
   *                 enum: [LGH, PB, FS, HN]
   *               key_system_id:
   *                 type: string
   *                 format: uuid
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       400:
   *         description: Invalid key_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await KeysApi.update(ctx.params.id, payload)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error updating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   delete:
   *     summary: Delete a key
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Deleted
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeysApi.remove(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error deleting key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== KEY SYSTEMS ROUTES ====================

  /**
   * @swagger
   * /key_systems:
   *   get:
   *     summary: List all key systems
   *     description: Retrieve a list of all key systems
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: Successfully retrieved key systems
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeySystem'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key_systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeySystemsApi.list()
    
    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key_systems/{id}:
   *   get:
   *     summary: Get key system by ID
   *     description: Retrieve a specific key system by its ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system
   *     responses:
   *       200:
   *         description: Successfully retrieved key system
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeySystem'
   *       404:
   *         description: Key system not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key_systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeySystemsApi.get(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error fetching key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key_systems:
   *   post:
   *     summary: Create a new key system
   *     description: Create a new key system
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               system_code:
   *                 type: string
   *                 description: Unique system code
   *               name:
   *                 type: string
   *                 description: Name of the key system
   *               type:
   *                 type: string
   *                 enum: [MECHANICAL, ELECTRONIC, HYBRID]
   *                 description: Type of key system
   *               description:
   *                 type: string
   *                 description: Description of the key system
   *             required:
   *               - system_code
   *               - name
   *               - type
   *     responses:
   *       201:
   *         description: Key system created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Invalid type or duplicate system code
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/key_systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await KeySystemsApi.create(payload)
    
    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error creating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key_systems/{id}:
   *   patch:
   *     summary: Update a key system
   *     description: Partially update a key system
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               system_code:
   *                 type: string
   *                 description: Unique system code
   *               name:
   *                 type: string
   *                 description: Name of the key system
   *               type:
   *                 type: string
   *                 enum: [MECHANICAL, ELECTRONIC, HYBRID]
   *                 description: Type of key system
   *               description:
   *                 type: string
   *                 description: Description of the key system
   *     responses:
   *       200:
   *         description: Key system updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Invalid type or duplicate system code
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Key system not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/key_systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await KeySystemsApi.update(ctx.params.id, payload)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error updating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key_systems/{id}:
   *   delete:
   *     summary: Delete a key system
   *     description: Delete a key system by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system to delete
   *     responses:
   *       200:
   *         description: Key system deleted successfully
   *       404:
   *         description: Key system not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/key_systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await KeySystemsApi.remove(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error deleting key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== LOGS ROUTES ====================

  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: List logs
   *     description: Returns logs ordered by event_time (desc).
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: List of logs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Log'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await LogsApi.list()
    
    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   get:
   *     summary: Get log by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Log found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await LogsApi.get(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error fetching log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs:
   *   post:
   *     summary: Create a log
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [user_name, event_type, object_type]
   *             properties:
   *               user_name:
   *                 type: string
   *                 example: "seb"
   *               event_type:
   *                 type: string
   *                 enum: [creation, update, delete]
   *                 example: "creation"
   *               object_type:
   *                 type: string
   *                 enum: [key, key_system, key_loan]
   *                 example: "key"
   *               description:
   *                 type: string
   *                 example: "Initial import"
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       400:
   *         description: Invalid or missing fields
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await LogsApi.create(payload)
    
    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error creating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   patch:
   *     summary: Update a log (partial)
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               user_name:
   *                 type: string
   *               event_type:
   *                 type: string
   *                 enum: [creation, update, delete]
   *               object_type:
   *                 type: string
   *                 enum: [key, key_system, key_loan]
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       400:
   *         description: Invalid event_type or object_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body
    
    const result = await LogsApi.update(ctx.params.id, payload)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error updating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   delete:
   *     summary: Delete a log
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Deleted
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    
    const result = await LogsApi.remove(ctx.params.id)
    
    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }
      
      logger.error({ err: result.err, metadata }, 'Error deleting log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })
}