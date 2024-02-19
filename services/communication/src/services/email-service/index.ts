import KoaRouter from '@koa/router'
import { sendEmail } from './adapters/email-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/sendMessage', async (ctx) => {
    const responseData = await sendEmail('johannes.karlsson@prototyp.se')

    ctx.body = {
      data: responseData,
    }
  })
}
