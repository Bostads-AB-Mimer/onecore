import pino from 'pino';
import Koa from 'koa';
import * as axios from 'axios';
export { axios as axiosTypes };
import { AsyncLocalStorage } from 'async_hooks';

declare const logger: pino.Logger<never>;

declare const middlewares: {
    pre: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>, next: Koa.Next) => Promise<any>;
    post: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>, next: Koa.Next) => Promise<void>;
};

declare const instance: axios.AxiosInstance;

declare const storage: AsyncLocalStorage<unknown>;
declare const getCorrelationId: () => string | undefined | null;

export { getCorrelationId, instance as loggedAxios, logger, middlewares as loggerMiddlewares, storage as loggingStorage };
