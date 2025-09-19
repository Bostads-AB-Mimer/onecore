import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './routes/keys'

export const routes = (router: KoaRouter) => {
  keyRoutes(router)
}
