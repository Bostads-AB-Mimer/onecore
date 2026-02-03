# ONECore - Inspection Service

Microservice for managing inspections (Besiktning) in ONECore. Integrates with XPAND to retrieve inspection data from the legacy database.

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
- **pnpm**
- **Node.js**
- **Docker**

### Install Instructions

#### Prepare environment

Run the `dev:init` script to create a file called `.env`, or manually make a copy of `.env.template`:

```sh
$ pnpm run dev:init
```

Or:

```sh
$ cp .env.template .env
```

Configure the required environment variables in the `.env` file:

**Inspection Database** (service's own database):
- `INSPECTION_DATABASE__HOST` - Database host
- `INSPECTION_DATABASE__USER` - Database user
- `INSPECTION_DATABASE__PASSWORD` - Database password
- `INSPECTION_DATABASE__PORT` - Database port
- `INSPECTION_DATABASE__DATABASE` - Database name

**XPAND Database** (legacy system integration):
- `XPAND_DATABASE__HOST` - XPAND database host
- `XPAND_DATABASE__USER` - XPAND database user
- `XPAND_DATABASE__PASSWORD` - XPAND database password
- `XPAND_DATABASE__PORT` - XPAND database port
- `XPAND_DATABASE__DATABASE` - XPAND database name

**Other Configuration**:
- `ELASTICSEARCH_LOGGING_HOST` - Elasticsearch host for logging
- `APPLICATION_NAME` - Application identifier

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
$ pnpm run install
```

#### Prepare database

Create the database schema by applying the `knex` migrations:

```sh
$ pnpm run migrate:up
```

### Running in Development Mode

When all installation steps have been completed and downstream services are running, a local development instance can be started using:

```sh
$ pnpm run dev
```

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
