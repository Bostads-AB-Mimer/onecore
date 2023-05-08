# Introduction

Template for a backend in [Koa](https://koajs.com/).

`src/api` includes a few routed endpoints with various usages of standard HTTP input and output.

`src/services/search-service` is a self-contained service with its own route and adapter, prepared to be
extracted into a separate micro service if/when appropriate.

## Installation

1. Install nvm
2. `nvm install`
3. `nvm use`
4. `npm run install`

## Development

`npm run dev`

## Tests

`npm run test`

## Misc

- [koa-pino-http](https://www.npmjs.com/package/koa-pino-logger) provides logging
- [Jest](https://jestjs.io/) is used for testing along with [supertest](https://www.npmjs.com/package/supertest)
- There is a simple error handler provided in [src/middleware/error-handler.ts]()
