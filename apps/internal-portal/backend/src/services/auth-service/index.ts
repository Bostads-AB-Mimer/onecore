import KoaRouter from '@koa/router'

import hash from './hash'
import { createToken } from './jwt'
import createHttpError from 'http-errors'
import config from '../../common/config'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/auth/login', async (ctx) => {
    const username = ctx.request.body?.username as string
    const password = ctx.request.body?.password as string

    if (!username || !password) {
      ctx.status = 400
      ctx.body = { errorMessage: 'Missing parameter(s): username, password' }
      return
    }

    try {
      const token = await createToken(username, password)

      ctx.cookies.set('yggdrasil', token.token, {
        httpOnly: true,
        overwrite: true,
        sameSite: 'lax',
        secure: false,
        domain: config.auth.cookieDomain,
      })

      ctx.body = { message: 'Login successful' }
    } catch (error) {
      if (createHttpError.isHttpError(error)) {
        ctx.status = (error as createHttpError.HttpError).statusCode
        ctx.body = { message: (error as createHttpError.HttpError).message }
      } else {
        ctx.status = 500
        ctx.body = { message: (error as Error).message }
      }
    }
  })
}
