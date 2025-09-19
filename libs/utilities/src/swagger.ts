import KoaRouter from '@koa/router'
import { z } from 'zod'
import swaggerJSDoc from 'swagger-jsdoc'

const schemaRegistry: Record<string, z.core.JSONSchema.BaseSchema> = {}

export function registerSchema(name: string, schema: z.ZodObject) {
  if (schemaRegistry[name]) {
    throw new Error(`Schema with name ${name} already exists`)
  }

  schemaRegistry[name] = z.toJSONSchema(schema, { unrepresentable: 'any' })
}

export function swaggerMiddleware({
  routes,
  schemas,
  serviceName,
  version,
}: {
  routes: string[]
  schemas?: Record<string, z.ZodObject>
  serviceName?: string
  version?: string
}) {
  if (schemas) {
    Object.entries(schemas).forEach(([name, schema]) =>
      registerSchema(name, schema)
    )
  }

  const router = new KoaRouter()

  router.get('/swagger.json', async (ctx) => {
    ctx.set('Content-Type', 'application/json')

    const swaggerSpec = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: serviceName ?? 'Swagger API',
          version: version ?? '1.0.0',
        },
        components: {
          schemas: schemaRegistry,
        },
      },
      apis: routes,
    }

    ctx.body = swaggerJSDoc(swaggerSpec)
  })

  return router.routes()
}
