import { Context, Next } from 'koa';

export default function errorHandler() {
  return async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      ctx.status = 500;
      let errorMessage = 'Unknown error';

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      ctx.body = {
        errorMessage,
        message: 'Internal server error',
      };

      ctx.app.emit('error', err);
    }
  };
}
