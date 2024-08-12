import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'

export const routes = (router: KoaRouter) => {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'onecore-leasing',
        version: '1.0.0',
      },
    },
    apis: [
      './src/services/health-service/*.ts',
      './src/services/creditsafe/*.ts',
      './src/services/lease-service/routes/*.ts',
    ],
  }

  const swaggerSpec = swaggerJsdoc(options)

  router.get('/swagger.json', async function (ctx) {
    ctx.set('Content-Type', 'application/json')
    ctx.body = swaggerSpec
  })
}
