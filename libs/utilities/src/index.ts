import logger, { middlewares } from './logging/logger'
import loggedAxios from './logging/loggedAxios'

export { logger, loggedAxios, middlewares as loggerMiddlewares }
