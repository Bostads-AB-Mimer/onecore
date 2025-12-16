import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'
import { swaggerSpec } from '../../swagger'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/swagger.json', async (ctx) => {
    ctx.set('Content-Type', 'application/json')
    ctx.body = swaggerJsdoc(swaggerSpec)
  })
}
