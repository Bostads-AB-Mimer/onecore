import { logger, middlewares } from './logging/logger'
export { errorHandler, etagMiddleware } from './middlewares/index'
import loggedAxios, { setExclusionFilters } from './logging/loggedAxios'
import { storage, getCorrelationId } from './logging/loggingStorage'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
  type RouteMetadata,
} from './routes/generateRouteMetadata'
import * as axiosTypes from 'axios'

export * from './excel'
export * from './health-check'
export * from './pagination'
export * from './search'
export * from './resource'
export {
  errorName,
  errorMessage,
  redactedMessage,
} from './logging/error-fields'

export {
  logger,
  loggedAxios,
  generateRouteMetadata,
  RouteMetadata,
  makeSuccessResponseBody,
  axiosTypes,
  setExclusionFilters as setAxiosExclusionFilters,
  storage as loggingStorage,
  getCorrelationId,
  middlewares as loggerMiddlewares,
}
