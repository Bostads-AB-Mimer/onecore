import logger, { middlewares } from './logging/logger'
import loggedAxios from './logging/loggedAxios'
import { storage, getCorrelationId } from './logging/loggingStorage'
import * as axiosTypes from 'axios'

export {
  logger,
  loggedAxios,
  storage as loggingStorage,
  getCorrelationId,
  axiosTypes,
  middlewares as loggerMiddlewares,
}
