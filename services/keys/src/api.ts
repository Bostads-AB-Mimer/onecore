import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './services/key-service'
import { routes as keyLoanRoutes } from './services/key-service/routes/key-loans'  // Add this line

const router = new KoaRouter()

keyRoutes(router)
keyLoanRoutes(router) 

export default router