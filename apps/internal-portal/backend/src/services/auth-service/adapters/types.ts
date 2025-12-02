import { DefaultContext, DefaultState, ParameterizedContext } from 'koa'
import KoaRouter from '@koa/router'

export interface AuthOptions {
  scopes: string[]
  redirectUri: string | undefined
  successRedirect: string | undefined
  postLogoutRedirectUri: string | undefined
}

export type AuthFunction<T = void> = (options?: AuthOptions) => KoaMiddleware<T>

export type KoaMiddleware<T = void> = (ctx: KoaContext) => Promise<T>

export type AuthAdapterFactory = (options?: AuthOptions) => AuthAdapter

export interface AuthAdapter {
  login: KoaMiddleware
  logout: KoaMiddleware
  acquireToken: KoaMiddleware
  handleCallback: KoaMiddleware
  handleRedirect: KoaMiddleware
}

export type KoaContext = ParameterizedContext<
  DefaultState,
  DefaultContext & KoaRouter.RouterParamContext<DefaultState, DefaultContext>,
  unknown
>
