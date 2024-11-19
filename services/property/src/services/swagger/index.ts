import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'
import { swaggerSpec } from '../../swagger'
import { ResidenceSchema } from '../../types/residence'
import zodToJsonSchema from 'zod-to-json-schema'

// Lägg till ResidenceSchemaJson i swaggerSpec
swaggerSpec.definition.components = {
  ...swaggerSpec.definition.components,
  schemas: {
    Residence: zodToJsonSchema(ResidenceSchema), // Lägg till Residence-schema
  },
}

const swaggerOptions = swaggerJsdoc(swaggerSpec)

export const routes = (router: KoaRouter) => {
  router.get('/swagger.json', async (ctx) => {
    ctx.set('Content-Type', 'application/json')
    ctx.body = swaggerOptions
  })
}
