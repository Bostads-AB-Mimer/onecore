import { logger, middlewares } from './logging/logger'
import loggedAxios, { setExclusionFilters } from './logging/loggedAxios'
import { storage, getCorrelationId } from './logging/loggingStorage'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from './routes/generateRouteMetadata'
import { swaggerMiddleware, registerSchema } from './swagger'
import * as axiosTypes from 'axios'

export * from './health-check'

export {
  logger,
  loggedAxios,
  generateRouteMetadata,
  makeSuccessResponseBody,
  axiosTypes,
  setExclusionFilters as setAxiosExclusionFilters,
  storage as loggingStorage,
  getCorrelationId,
  middlewares as loggerMiddlewares,
  swaggerMiddleware,
  registerSchema,
}
