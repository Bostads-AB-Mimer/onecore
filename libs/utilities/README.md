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

### Testing

In unit tests, you usually want the logger to be mocked away. There are multiple reasons for this - one is that the logger will try to connect to ElasticSearch, which if it succeeds leaves an open handle that will keep jest from finishing. Another is that the logger's console output will seriously clutter the test runner output.

If you are only using the logger, mock that away:

```
jest.mock('onecore-utilities', () => {
  return {
    logger: {
      debug: () => { return },
      log: () => { return },
      info: () => { return },
      warn: () => { return },
      error: () => { return },
    },
  }
})
```

If you are using loggedAxios you will also have to mock that away, since it uses the logger. The easiest way to do this is to replace it with regular Axios and then mock that as you would usually mock Axios (just make sure it's the same version as the one used by loggingAxios):

```
import axios from 'axios'
jest.mock('onecore-utilities', () => {
  return {
    logger: {
      debug: () => { return },
      log: () => { return },
      info: () => { return },
      warn: () => { return },
      error: () => { return },
    },
    loggedAxios: axios,
    axiosTypes: axios,
  }
})
```

## Development

### Local development

When working with this package, you need to run `npm run build` after every code change to make sure the dist folder is updated for each flavor of JavaScript.

The easiest way to use a local version of the package in your application is to use `npm link`:

In this project's folder, run `npm link`

In your application's folder, run `npm link onecore-utilities`

This will symlink the application's node_modules/onecore-utilities to this project folder.

When you are done, run `npm unlink onecore-utilities` in the application's folder.

### Releases

This package uses Google's Release Please package, that will create a PR for release every time it encounters a merged commit message starting with one of the following:

- fix: which represents bug fixes, and correlates to a SemVer patch.
- feat: which represents a new feature, and correlates to a SemVer minor.
- feat!:, or fix!:, refactor!:, etc., which represent a breaking change (indicated by the !) and will result in a SemVer major.

So the process to make a new version that is released to NPM is:

1. Create a branch
2. Commit at least one message with one of the prefixes above (feat/fix)
3. Merge branch to main. This automatically creates a release PR with bumped version numbers.
4. Merge release PR to main. This automatically published this package to NPM.

The NPM web CDN is notoriously slow, so don't be alarmed if npmjs.org doesn't show the new package version immediately. Installing the new version in your applications with npm should be available instantly though.
