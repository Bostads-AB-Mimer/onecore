import { logger, middlewares } from './logging/logger'
import loggedAxios, { setExclusionFilters } from './logging/loggedAxios'
import { storage, getCorrelationId } from './logging/loggingStorage'
import { generateRouteMetadata } from './routes/generateRouteMetadata'
import * as axiosTypes from 'axios'

export {
  logger,
  loggedAxios,
  generateRouteMetadata,
  axiosTypes,
  setExclusionFilters as setAxiosExclusionFilters,
  storage as loggingStorage,
  getCorrelationId,
  middlewares as loggerMiddlewares,
}
