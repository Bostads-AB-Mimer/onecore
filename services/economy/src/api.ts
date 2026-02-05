import KoaRouter from '@koa/router'
import { routes as invoiceRoutes } from './services/invoice-service'
import { routes as procurementInvoiceRoutes } from './services/procurement-invoice-service'
import { routes as debtCollectionRoutes } from './services/debt-collection-service'
import { routes as healthRoutes } from './services/health-service'
import { routes as reportRoutes } from './services/report-service'

const router = new KoaRouter()

invoiceRoutes(router)
procurementInvoiceRoutes(router)
debtCollectionRoutes(router)
healthRoutes(router)
reportRoutes(router)

export default router
