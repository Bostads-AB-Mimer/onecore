import KoaRouter from '@koa/router'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Inspection
 *     description: Operations related to inspections (Besiktning)
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /inspections:
   *   get:
   *     summary: Get list of inspections
   *     tags:
   *       - Inspection
   *     description: Retrieves a list of inspections. This is a placeholder endpoint.
   *     responses:
   *       '200':
   *         description: Successful response with list of inspections
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 inspections:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Inspection ID
   *                       status:
   *                         type: string
   *                         description: Inspection status
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: Creation timestamp
   */
  router.get('/inspections', async (ctx) => {
    ctx.body = {
      inspections: [
        {
          id: '1',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ],
    }
  })

  /**
   * @swagger
   * /inspections/{id}:
   *   get:
   *     summary: Get inspection by ID
   *     tags:
   *       - Inspection
   *     description: Retrieves a specific inspection by its ID. This is a placeholder endpoint.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Inspection ID
   *     responses:
   *       '200':
   *         description: Successful response with inspection details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   description: Inspection ID
   *                 status:
   *                   type: string
   *                   description: Inspection status
   *                 createdAt:
   *                   type: string
   *                   format: date-time
   *                   description: Creation timestamp
   */
  router.get('/inspections/:id', async (ctx) => {
    const { id } = ctx.params
    ctx.body = {
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
  })
}
