import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './services/key-service'
import { routes as swaggerRoutes } from './services/swagger'
import { updateSwaggerSchemas } from './swagger'   



const router = new KoaRouter()

// Register all routes
keyRoutes(router)


// Update swagger schemas after all routes are registered
updateSwaggerSchemas()

export default router
