import KoaRouter from '@koa/router'
import validator from 'validator'
import { sendEmail } from './adapters/infobip-adapter'
import { Email } from 'onecore-types'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/sendMessage', async (ctx) => {
    const message = ctx.request.body
    if (!isMessageEmail(message)) {
      ctx.throw(400, 'Message is not an email object')
      return
    }
    try {
      const result = await sendEmail(message)
      ctx.status = 200
      ctx.body = result.data
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
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
