import pino from 'pino';
import Koa, { Context } from 'koa';
import axios__default from 'axios';
import * as axios from 'axios';
export { axios as axiosTypes };
export { default as loggedAxios } from 'axios';
import { AsyncLocalStorage } from 'async_hooks';

declare const logger: pino.Logger<never>;
declare const middlewares: {
    pre: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>, next: Koa.Next) => Promise<any>;
    post: (ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>, next: Koa.Next) => Promise<void>;
};

declare const setExclusionFilters: (exlusionFilters: RegExp[]) => void;

declare const storage: AsyncLocalStorage<unknown>;
declare const getCorrelationId: () => string | undefined | null;

interface RouteMetadata {
    _links: {
        self: {
            href: string;
        };
        link: {
            href: string;
            templated: boolean;
        };
    };
}
declare const generateRouteMetadata: (ctx: Context, queryParams?: string[]) => RouteMetadata;

export { generateRouteMetadata, getCorrelationId, logger, middlewares as loggerMiddlewares, storage as loggingStorage, setExclusionFilters as setAxiosExclusionFilters };
