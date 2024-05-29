# onecore-utilities

Useful utilities used in various places in the ONECore platform.

## logger

A logger that logs to the console and to ElasticSearch.

### General use

```
import { logger } from 'onecore-utilities'

logger.warn(aMessage)
logger.info(anObject, aMessage)
```

### Koa request logging

loggerMiddlewares.pre will log all incoming requests at the start of the request
loggerMiddlewares.post will log all incoming requests at the end of the request

```
import { loggerMiddlewares } from 'onecore-utilities'

// Log the start and completion of all incoming requests
app.use(loggerMiddlewares.pre)
app.use(loggerMiddlewares.post)
```

### Configuration

Set environment variable `ELASTICSEARCH_LOGGING_HOST` to the full url of your ElasticSearch server.

## loggedAxios

A standard Axios with interceptors for request and response that logs all requests and their
completions to logger, with a subset of fields from the Axios request and response objects.

### Configuration

Set environment variable `ELASTICSEARCH_LOGGING_HOST` to the full url of your ElasticSearch server.

### General use

Use as you would use standard Axios.

```
import { loggedAxios as axios } from 'onecore-utilities'

const response = await axios('http://localhost')
```
