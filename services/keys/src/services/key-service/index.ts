import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './routes/keys'
import { routes as keySystemRoutes } from './routes/key-systems'
import { routes as keyLoanRoutes } from './routes/key-loans'
import { routes as logRoutes } from './routes/logs'

export const routes = (router: KoaRouter) => {
  keyRoutes(router)
  keySystemRoutes(router)
  keyLoanRoutes(router)
  logRoutes(router)
}
