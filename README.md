# ONECore

[![CI](https://github.com/Bostads-AB-Mimer/onecore/actions/workflows/ci.yaml/badge.svg)](https://github.com/Bostads-AB-Mimer/onecore/actions/workflows/lint.yaml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--only-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E=20.x-brightgreen)](https://nodejs.org/en/)

Monorepo containing all base services and applications of the ONECore platform.

## Overview

### Repository structure

Apart from the core orchestration service, packages belong to one of three categories:

- **`apps`** - User-facing frontend applications
- **`libs`** - Libraries containing common functionality
- **`services`** - Microservices that provide ONECore features

```
.
├── core/
├── apps/
│   ├── internal-portal/
│   └── property-tree/
├── libs/
│   ├── types/
│   └── utilities/
└── services/
    ├── communication/
    ├── leasing/
    ├── property/
    ├── property-management/
    └── work-order/
    └── economy/
```

### Getting started

#### Requirements

We use pnpm as our package manager: https://pnpm.io/installation

After cloning the repository, make sure that you have the following installed on your system:

- **nvm**
- **pnpm**
- **Node.js**
- **Docker**

#### Install runtime

Install the required node version using `nvm`, if not already installed.

```sh
nvm install
```

Activate the required node version.

```sh
nvm use
```

#### Install dependencies

Install dependencies. This may take 1-2 minutes, as it will resolve and download all packages required by all ONECore modules, as well as check for version conflicts.

```sh
pnpm install
```

#### Run dev:init

This will run any one-off initialization scripts in all modules that provide them.  
Nearly all modules use dotenv/.env-files that are required to run with a local configuration, and these will be created with default values.
Some of these still require manual attention after running this script, as some applications depend on non-public resources.

```sh
pnpm run dev:init
```

#### Run generate:static

This will generate required code that is not subject to version control, like Prisma schemas.

```sh
pnpm run generate:static
```

#### Build libs

Most projects rely on the projects under libs/ and will not run or build unless they are built in your local project tree.

```sh
pnpm run build:libs
```

#### Dockerized services

Some services depend on databases and kibana/elastic-search for logging. These can all be started as local Docker containers using `docker compose`

```sh
docker compose up -d
```

These services will apply schema migrations/updates as needed on startup, but they will not create the logical schema/database.

Once the SQL container is running, you can create these by running:

```sh
pnpm run db:init
```

### Local development

[Turborepo](https://turborepo.com/) lets us run multiple packages simultaneously in a tidy manner using its "tui" configuration.

```sh
pnpm run dev # runs everything
pnpm run dev -- --filter='!@onecore/property' # runs everything except for @onecore/property
pnpm run dev -- --filter='@onecore/property' # runs only @onecore/property
```

Furthermore, turborepo handles different packages dependencies. If we run @onecore/leasing, which uses libs/types and libs/utilities, both of these packages will be built before leasing starts.

More information on running tasks [can be found here](https://turborepo.com/docs/crafting-your-repository/running-tasks).

More information on filtering [can be found here](https://turborepo.com/docs/reference/run#advanced-filtering-examples).

More information on the terminal UI [can be found here](https://turborepo.com/docs/crafting-your-repository/developing-applications#using-the-terminal-ui).

See the respective packages of this repository for more information.

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
