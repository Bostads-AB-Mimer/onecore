import KoaRouter from '@koa/router'
import { generateRouteMetadata } from 'onecore-utilities'
import { MaterialChoice, MaterialOptionGroup } from 'onecore-types'
import {
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoicesByRoomTypes,
  getMaterialChoicesByApartmentId,
  saveMaterialChoices,
  getApartmentMaterialChoiceStatuses,
  filterRoomTypes,
  sortRoomTypes,
} from '../adapters/material-options-adapter'
import { getRoomTypes } from '../adapters/contech-os-adapter'

/**
 * @swagger
 * tags:
 *   - name: Material Choices
 *     description: Endpoints related to material choices operations
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rentalproperties/{id}/material-options:
   *   get:
   *     summary: Get room types with material options by rental property ID
   *     tags:
   *       - Property management
   *     description: Retrieve room types along with their material options for a specified rental property ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch room types and material options for.
   *     responses:
   *       '200':
   *         description: Successful response with room types and their material options.
   *         content:
   *          application/json:
   *             schema:
   *               type: object
   */
  router.get('(.*)/rentalproperties/:id/material-options', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const roomTypes = await getRoomTypes(ctx.params.id)
    const materialOptions = await getRoomTypeWithMaterialOptions(roomTypes)

    ctx.body = {
      content: materialOptions,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /rentalproperties/{id}/material-options/{materialOptionId}:
   *   get:
   *     summary: Get material option by ID for a specific rental property
   *     tags:
   *      - Property management
   *     description: Retrieve a specific material option for a rental property by its ID and the material option ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch material options from.
   *       - in: path
   *         name: materialOptionId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the material option to fetch.
   *     responses:
   *       '200':
   *         description: Successful response with the requested material option.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  router.get(
    '(.*)/rentalproperties/:id/material-options/:materialOptionId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const option = await getMaterialOption(ctx.params.materialOptionId)
      ctx.body = { content: option, ...metadata }
    }
  )

  /**
   * @swagger
   * /rentalproperties/{id}/rooms-with-material-choices:
   *   get:
   *     summary: Get rooms with material choices for a specific rental property
   *     tags:
   *       -  Property management
   *     description: Retrieve rooms with their associated material choices for a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch rooms with material choices for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested rooms and their material choices.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 roomTypes:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.get(
    '(.*)/rentalproperties/:id/rooms-with-material-choices',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const apartmentId = ctx.params.id
      const roomTypes = await getRoomTypes(apartmentId)
      const matarialChoices = await getMaterialChoicesByRoomTypes({
        apartmentId: apartmentId,
      })
      for (const roomType of roomTypes) {
        roomType.materialOptionGroups = matarialChoices.filter(
          (materialGroup: MaterialOptionGroup) => {
            return materialGroup.roomTypeId == roomType.roomTypeId
          }
        )
      }
      ctx.body = {
        content: roomTypes.filter(filterRoomTypes).sort(sortRoomTypes),
        ...metadata,
      }
    }
  )

  /**
   * @swagger
   * /rentalproperties/{id}/material-choices:
   *   get:
   *     summary: Get material choices for a specific rental property
   *     tags:
   *       -  Property management
   *     description: Retrieve material choices associated with a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch material choices for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested material choices
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 materialChoices:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const apartmentId = ctx.params.id
    const materialChoices = await getMaterialChoicesByApartmentId(apartmentId)

    ctx.body = { content: materialChoices, ...metadata }
  })

  /**
   * @swagger
   * /rentalproperties/{apartmentId}/{contractId}/material-choices:
   *   get:
   *     summary: Get material choices for a specific apartment and contract
   *     tags:
   *       - Property management
   *     description: Retrieve material choices associated with a specific apartment and contract identified by {apartmentId} and {contractId}.
   *     parameters:
   *       - in: path
   *         name: apartmentId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the apartment to fetch material choices for.
   *       - in: path
   *         name: contractId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the contract to fetch material choices for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested material choices
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 materialChoices:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.get(
    '(.*)/rentalproperties/:apartmentId/:contractId/material-choices',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const apartmentId = ctx.params.apartmentId + '/' + ctx.params.contractId
      const materialChoices = await getMaterialChoicesByApartmentId(apartmentId)

      ctx.body = { content: materialChoices, ...metadata }
    }
  )

  /**
   * @swagger
   * /rentalproperties/material-choice-statuses:
   *   get:
   *     summary: Get material choice statuses for rental properties
   *     tags:
   *       - Property management
   *     description: Retrieve the statuses of material choices associated with rental properties.
   *     parameters:
   *       - in: query
   *         name: projectCode
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional project code to filter the material choice statuses.
   *     responses:
   *       '200':
   *         description: Successful response with the material choice statuses
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   */
  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const apartmentChoiceStatuses = await getApartmentMaterialChoiceStatuses(
      ctx.params.projectCode
    )
    ctx.body = { content: apartmentChoiceStatuses, ...metadata }
  })

  /**
   * @swagger
   * /rentalproperties/{id}/material-choices:
   *   post:
   *     summary: Save material choices for a specific rental property
   *     tags:
   *       - Property management
   *     description: Save the material choices associated with a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to save material choices for.
   *     requestBody:
   *       description: Array of material choices to be saved
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: array
   *             items:
   *               type: object
   *     responses:
   *       '200':
   *         description: Successful response with the saved material choices
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   */
  router.post('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await saveMaterialChoices(
      ctx.params.id,
      ctx.request.body as Array<MaterialChoice>
    )
    ctx.body = { content: result, ...metadata }
  })
}
