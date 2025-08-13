# ONECore - Leasing Microservice

Microservice for tenants and leases in ONECore.

## Overview

### Swagger

We utilize `koa2-swagger-ui` and `swagger-jsdoc` for documenting our API. Each endpoint is required to have appropriate
JSDoc comments and tags for comprehensive documentation. The Swagger document is exposed on `/swagger`.

## Development

### Requirements

This application requires the following to be installed on your system:

- **nvm**
- **npm**
- **Node.js**
- **Docker**

### Install Instructions

#### Prepare environment

Run the `dev:init` script to create a file called `.env`, or manually make a copy of `.env.template`:

```sh
$ npm run dev:init
```

Or:

```sh
$ cp .env.template .env
```

#### Install runtime

Install the required node version, if not already installed.

```sh
$ nvm install
```

Activate the required node version.

```sh
$ nvm use
```

#### Install dependencies

Install dependencies

```sh
$ npm run install
```

#### Configure services

Start the development services from the monorepo root directory:

```sh
<monorepo root> $ docker-compose up -d
```

This will start the required services inside a Docker container. This is a shared container used by all services, and it only needs to be started once.

#### Setup database

Initialize the database:

```sh
<monorepo root> $ npm run db:init
```

#### Prepare database

Create the database schema by applying the `knex` migrations:

```sh
$ npm run migrate:up
```

### Running in Development Mode

When all installation steps have been completed and downstreams services are running, a local development instance can be started using:

```sh
$ npm run dev
```

### Testing

The test suite requires a dedicated database for our database unit tests to run.
If you've run the db:init npm script, this test db has already been created.

Make a copy of `.env.test.template` called `.env.test` and supply
the credentials to your database.

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
