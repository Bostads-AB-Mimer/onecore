import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'

export const routes = (router: KoaRouter) => {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'onecore-core',
        version: '1.0.0',
      },
    },
    apis: [
      './src/services/auth-service/index.ts',
      './src/services/health-service/index.ts',
      './src/services/lease-service/index.ts',
      './src/services/property-management-service/index.ts',
      './src/services/ticketing-service/index.ts',
    ], //todo: add all routes
  }

  const swaggerSpec = swaggerJsdoc(options)

  router.get('/swagger.json', async function (ctx) {
    ctx.set('Content-Type', 'application/json')
    ctx.body = swaggerSpec
  })
}
