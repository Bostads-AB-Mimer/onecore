import KoaRouter from '@koa/router'
import validator from 'validator'
import { sendEmail } from './adapters/infobip-adapter'
import { Email } from 'onecore-types'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/sendMessage', async (ctx) => {
    const message = ctx.request.body
    if (!isMessageEmail(message)) {
      ctx.throw(400, 'Message is not an email object')
    } else {
      const responseData = await sendEmail(message)
      ctx.body = 'Emails sent: ' + responseData.messages.length
    }
  })
}

export const isMessageEmail = (message: any): message is Email => {
  return !!(
    message &&
    typeof message === 'object' &&
    message.to &&
    typeof message.to === 'string' &&
    validator.isEmail(message.to) &&
    message.subject &&
    typeof message.subject === 'string' &&
    message.text &&
    typeof message.text === 'string'
  )
}
