import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'
import { swaggerSpec } from '../../swagger'
import { OkapiRouter } from 'koa-okapi-router'

const swaggerOptions = swaggerJsdoc(swaggerSpec) as any

export const routes = (router: KoaRouter, apiRouter: OkapiRouter) => {
  router.get('(.*)/swagger.json', async (ctx) => {
    ctx.set('Content-Type', 'application/json')

    const apiSpec = apiRouter.extendOpenApiJson(swaggerOptions) as any

    ctx.body = apiSpec
  })
}
