/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getComponentById, getComponents } from '../adapters/component-adapter'
import {
  ComponentSchema,
  componentsQueryParamsSchema,
} from '../types/component'
import { generateMetaLinks } from '../utils/links'
import { ComponentLinksSchema } from '../types/links'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Components
 *     description: Operations related to components
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /components:
   *   get:
   *     summary: Get components by building code, floor code, residence code, and room code.
   *     description: Returns all components belonging to a specific room.
   *     tags:
   *       - Components
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building for the components.
   *       - in: query
   *         name: floorCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The floor code of the staircase for the building.
   *       - in: query
   *         name: residenceCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The residence code where the components are located.
   *       - in: query
   *         name: roomCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The room code where the components are located.
   *     responses:
   *       200:
   *         description: Successfully retrieved the components.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     allOf:
   *                       - $ref: '#/components/schemas/Component'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/components', async (ctx) => {
    const queryParams = componentsQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { buildingCode, floorCode, residenceCode, roomCode } =
      queryParams.data

    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /components?buildingCode=${buildingCode}&floorCode=${floorCode}&residenceCode=${residenceCode}&roomCode=${roomCode}`,
      metadata
    )

    try {
      const components = await getComponents(
        buildingCode,
        floorCode,
        residenceCode,
        roomCode
      )

      const responseContent = components.map((component) => {
        const parsedComponent = ComponentSchema.parse({
          ...component,
        })
        return {
          ...parsedComponent,
          _links: ComponentLinksSchema.parse({
            self: { href: `/components/${component.id}` },
            parent: {
              href: `/residences/${residenceCode}`,
            },
            residence: { href: `/residences/${residenceCode}` },
          }),
        }
      })
      ctx.body = {
        content: responseContent,
        ...metadata,
      }
    } catch (err) {
      console.log(err)
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /components/{id}:
   *   get:
   *     summary: Get a component by ID
   *     description: Returns a component with the specified ID
   *     tags:
   *       - Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the component
   *     responses:
   *       200:
   *         description: Successfully retrieved the component
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Component'
   *       404:
   *         description: Component not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    logger.info(`GET /components/${id}`, metadata)

    try {
      const component = await getComponentById(id)
      if (!component) {
        ctx.status = 404
        return
      }

      ctx.body = {
        content: component,
        ...metadata,
        _links: generateMetaLinks(ctx, '/components', {
          id: ctx.params.response,
        }),
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
