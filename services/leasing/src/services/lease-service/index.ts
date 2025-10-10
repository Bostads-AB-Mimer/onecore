import KoaRouter from '@koa/router'
import { routes as offerRoutes } from './routes/offers'
import { routes as commentRoutes } from './routes/comments'
import { routes as contactRoutes } from './routes/contacts'
import { routes as invoiceRoutes } from './routes/invoices'
import { routes as leaseRoutes } from './routes/leases'
import { routes as listingRoutes } from './routes/listings'
import { routes as applicantsRoutes } from './routes/applicants'
import { routes as rentalObjectsRoutes } from './routes/rental-objects'
import { routes as listingTextContentRoutes } from './routes/listing-text-content'

export const routes = (router: KoaRouter) => {
  applicantsRoutes(router)
  offerRoutes(router)
  commentRoutes(router)
  contactRoutes(router)
  invoiceRoutes(router)
  leaseRoutes(router)
  listingRoutes(router)
  rentalObjectsRoutes(router)
  listingTextContentRoutes(router)
}
