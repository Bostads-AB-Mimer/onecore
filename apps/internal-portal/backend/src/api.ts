import KoaRouter from '@koa/router'
import { routes as propertyInfoRoutes } from './services/property-info-service'
import { routes as commentsRoutes } from './services/leasing-service/comments'
import { routes as contactsRoutes } from './services/leasing-service/contacts'
import { routes as offersRoutes } from './services/leasing-service/offers'
import { routes as listingsRoutes } from './services/leasing-service/listings'
import { routes as invoicesRoutes } from './services/invoices/invoices'
import { routes as rentalObjectsRoutes } from './services/leasing-service/rental-objects'
import { routes as listingTextContentRoutes } from './services/leasing-service/listing-text-content'

const router = new KoaRouter()

commentsRoutes(router)
contactsRoutes(router)
offersRoutes(router)
listingsRoutes(router)
rentalObjectsRoutes(router)
listingTextContentRoutes(router)

propertyInfoRoutes(router)
invoicesRoutes(router)

export default router
