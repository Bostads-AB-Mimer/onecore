import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './routes/keys'
import { routes as keyLoansRoutes } from './routes/key-loans'
import { routes as keySystemRoutes } from './routes/key-systems'

export const routes = (router: KoaRouter) => {
  keyRoutes(router)
  keyLoansRoutes(router)
  keySystemRoutes(router)
}
