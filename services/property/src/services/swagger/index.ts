import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'
import { swaggerSpec } from '../../swagger'
import { ResidenceSchema } from '../../types/residence'
import { BuildingTypeSchema, BuildingListSchema } from '../../types/building'
import { ComponentTypeSchema, ComponentListSchema } from '../../types/component'
import { PropertyTypeSchema, PropertyListSchema } from '../../types/property'
import zodToJsonSchema from 'zod-to-json-schema'

swaggerSpec.definition.components = {
  ...swaggerSpec.definition.components,
  schemas: {
    Residence: zodToJsonSchema(ResidenceSchema),
    Building: zodToJsonSchema(BuildingTypeSchema),
    BuildingList: zodToJsonSchema(BuildingListSchema),
    Component: zodToJsonSchema(ComponentTypeSchema),
    ComponentList: zodToJsonSchema(ComponentListSchema),
    Property: zodToJsonSchema(PropertyTypeSchema),
    PropertyList: zodToJsonSchema(PropertyListSchema),
  },
}

const swaggerOptions = swaggerJsdoc(swaggerSpec)

export const routes = (router: KoaRouter) => {
  router.get('/swagger.json', async (ctx) => {
    ctx.set('Content-Type', 'application/json')
    ctx.body = swaggerOptions
  })
}
