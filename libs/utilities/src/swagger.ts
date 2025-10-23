import KoaRouter from '@koa/router'
import swaggerJSDoc from 'swagger-jsdoc'
import { z } from 'zod'

const schemaRegistry: Record<string, z.core.JSONSchema.BaseSchema> = {}

export function registerSchema(name: string, schema: z.ZodType) {
  if (schemaRegistry[name]) {
    throw new Error(`Schema with name ${name} already exists`)
  }

  schemaRegistry[name] = z.toJSONSchema(schema, {
    unrepresentable: 'any',
    target: 'openapi-3.0',
    override: (ctx) => {
      const def = ctx.zodSchema._zod.def
      if (def.type === 'date') {
        ctx.jsonSchema.type = 'string'
        ctx.jsonSchema.format = 'date-time'
      }
    },
  })
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
