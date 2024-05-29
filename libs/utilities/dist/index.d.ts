import pino from 'pino';
import Koa from 'koa';
import * as axios from 'axios';

declare const logger: pino.Logger<never>;

declare const middlewares: {
    pre: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>, next: Koa.Next) => Promise<any>;
    post: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>, next: Koa.Next) => Promise<void>;
};

declare const instance: axios.AxiosInstance;

export { instance as loggedAxios, logger, middlewares as loggerMiddlewares };
