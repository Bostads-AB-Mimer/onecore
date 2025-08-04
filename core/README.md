# ONECore - Core API Service

Core orchestration for ONECore.


## Overview

### Documentation of processes in Core

Each process (/processes) is documented through flowcharts and sequence diagrams to clearly demonstrate what the process does and which underlying services are used during the process. To create flowcharts and sequence diagrams, we're using Mermaid for markdown which makes adjustments and collaboration easy. Diagrams in Mermaid can be viewed on GitHub or with the help of a plugin, such as https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid for VSCode.


### Swagger

We utilize `koa2-swagger-ui` and `swagger-jsdoc` for documenting our API. Each endpoint is required to have appropriate JSDoc comments and tags for comprehensive documentation. The Swagger document is exposed on `/swagger`.


## Development

### Requirements

This application requires the following to be installed on your system:


 * **nvm**
 * **npm**
 * **Node.js**
 * **Docker**

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
<monorepo root> $ docker-compose up -d &
```

This will start the required services inside a Docker container. This is a shared container used by all services, and it only needs to be started once.


#### Setup database

Create an empty database for the application:


```sh
$ docker compose exec -i sql /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P p455w0rd -Q "CREATE DATABASE [tenants-leases];"
```

### Running in Development Mode

When all installation steps have been completed and downstreams services are running, a local development instance can be started using:


```sh
$ npm run dev
```

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)

