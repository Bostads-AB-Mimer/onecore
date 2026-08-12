import KoaRouter from '@koa/router'

import { routes as smsRoutes } from './routes/sms'
import { routes as emailRoutes } from './routes/email'
import { routes as webhookRoutes } from './routes/webhooks'

export const routes = (router: KoaRouter) => {
  smsRoutes(router)
  emailRoutes(router)
  webhookRoutes(router)
}

// Re-exports kept so existing imports (tests + any other consumers) keep
// working after the routes were split into ./routes/sms and ./routes/email.
export {
  isValidParkingSpaceOfferSms,
  isValidWorkOrderSms,
  isValidBulkSms,
  MAX_BULK_SMS_RECIPIENTS,
} from './routes/sms'
export {
  isMessageEmail,
  isParkingSpaceOfferEmail,
  isValidBulkEmail,
} from './routes/email'
