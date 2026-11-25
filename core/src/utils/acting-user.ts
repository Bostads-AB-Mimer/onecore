import { Context } from 'koa'

// Display name of the authenticated caller, for audit columns such as
// triggeredByUser and createdBy. Undefined when the token carries neither.
export const getActingUserName = (ctx: Context): string | undefined =>
  ctx.state.user?.name ?? ctx.state.user?.preferred_username
