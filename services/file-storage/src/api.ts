import KoaRouter from '@koa/router'

import { routes as fileStorageRoutes } from './services/file-storage-service'
import { routes as healthRoutes } from './services/health-service'

const router = new KoaRouter()

fileStorageRoutes(router)
healthRoutes(router)

export default router
