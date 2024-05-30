# onecore-utilities

Useful utilities used in various places in the ONECore platform.

## logging

### logger

A logger based on Pino that logs to the console and to ElasticSearch. When logging from inside route handlers in Koa, a correlation id is automatically appended that will stay the same during a request.

If the ElasticSearch instance is or becomes unreachable, the application will continue running an still log to stdout.

#### General use

```
import { logger } from 'onecore-utilities'

logger.warn(aMessage)
logger.info(anObject, aMessage)
```

#### Koa request logging

`loggerMiddlewares.pre` will log the start of all incoming requests.<br>
`loggerMiddlewares.post` will log the completion of all incoming requests.

```
import { loggerMiddlewares } from 'onecore-utilities'

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)
```

The pre middleware automatically creates a correlationId (UUID) and attaches it to the ctx object as ctx.correlationId. All logging inside a route handler (and any files used by it) will automatically get the correlationId appended.

#### Configuration

Set environment variable `ELASTICSEARCH_LOGGING_HOST` to the full url of your ElasticSearch server.<br>
Set environment variable `APPLICATION_NAME` to the name of the application.

### loggedAxios

A standard Axios with interceptors for request and response that logs all requests and their completions to logger, with a subset of fields from the Axios request and response objects and a correlationId.

#### Configuration

Set environment variable `ELASTICSEARCH_LOGGING_HOST` to the full url of your ElasticSearch server.<br>
Set environment variable `APPLICATION_NAME` to the name of the application.

loggedAxios will automatically append correlationId from the store, append it to its logging and automatically add the header `x-correlation-id` to all its requests, to make sure the id propagates to integrated services.

#### General use

Use as you would use standard Axios.

```
import { loggedAxios as axios } from 'onecore-utilities'

const response = await axios('http://localhost')
```
