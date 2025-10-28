# ONECore - Inspection Service

Microservice for managing inspections (Besiktning) in ONECore.

## Overview

### Swagger

We utilize `swagger-jsdoc` for documenting our API. Each endpoint is required to have appropriate
JSDoc comments and tags for comprehensive documentation. The Swagger document is exposed on `/swagger.json`.

### Routes

#### Inspection Service

- **GET /inspections**
  - Retrieves a list of inspections (placeholder endpoint).

#### Health Service

- **GET /health**
  - Retrieves the health status of the system and its subsystems.

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

#### Prepare database

Create the database schema by applying the `knex` migrations:

```sh
$ npm run migrate:up
```

### Running in Development Mode

When all installation steps have been completed and downstream services are running, a local development instance can be started using:

```sh
$ npm run dev
```

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
