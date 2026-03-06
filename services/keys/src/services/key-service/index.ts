import KoaRouter from '@koa/router'
import { routes as keyRoutes } from './routes/keys'
import { routes as keySystemRoutes } from './routes/key-systems'
import { routes as keyLoanRoutes } from './routes/key-loans'
import { routes as logRoutes } from './routes/logs'
import { routes as receiptRoutes } from './routes/receipts'
import { routes as keyNoteRoutes } from './routes/key-notes'
import { routes as keyEventRoutes } from './routes/key-events'
import { routes as keyBundleRoutes } from './routes/key-bundles'
import { routes as signatureRoutes } from './routes/signatures'
import { routes as daxRoutes } from './routes/dax'
import { routes as cardRoutes } from './routes/cards'
import { routes as scanReceiptRoutes } from './routes/scan-receipt'

export const routes = (router: KoaRouter) => {
  keyRoutes(router)
  keySystemRoutes(router)
  keyLoanRoutes(router)
  logRoutes(router)
  receiptRoutes(router)
  keyNoteRoutes(router)
  keyEventRoutes(router)
  keyBundleRoutes(router)
  signatureRoutes(router)
  daxRoutes(router)
  cardRoutes(router)
  scanReceiptRoutes(router)
}
