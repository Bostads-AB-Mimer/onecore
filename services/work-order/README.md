# ONECore - Work Order

Microservice for managing work orders in ONECore. This microservice integrates with Odoo (an open-source ERP system) to handle work orders efficiently, allowing us to sync work orders between ONECore and Odoo, retrieve and update work order details, and ensure data consistency across both systems.

## Overview

### Swagger

We utilize `swagger-jsdoc` for documenting our API. Each endpoint is required to have appropriate
JSDoc comments and tags for comprehensive documentation. The Swagger document is exposed on `/swagger.json`.

### Routes

#### Work Order Service

- **GET /workOrders/contactCode/{contactCode}**
  - Retrieves work orders based on the provided contact code.

- **POST /workOrders**
  - Creates a new work order based on the provided request body.

- **POST /workOrders/{workOrderId}/update**
  - Adds a message to a work order based on the provided work order ID.

- **POST /workOrders/{workOrderId}/close**
  - Closes a work order based on the provided work order ID.

#### Health Service

- **GET /health**
  - Retrieves the health status of the system and its subsystems.

## Development

### Requirements

We use pnpm as our package manager: https://pnpm.io/installation

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

When all installation steps have been completed and downstreams services are running, a local development instance can be started using:

```sh
$ pnpm run dev
```

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
