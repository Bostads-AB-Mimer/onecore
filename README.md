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
```

### Local development

[Turborepo](https://turborepo.com/) lets us run multiple packages simultaneously in a tidy manner using its "tui" configuration.

```sh
npm run dev # runs everything
npm run dev -- --filter='!@onecore/property' # runs everything except for @onecore/property
npm run dev -- --filter='@onecore/property' # runs only @onecore/property
```

Furthermore, turborepo handles different packages dependencies. If we run @onecore/leasing, which uses libs/types and libs/utilities, both of these packages will be built before leasing starts.

More information on running tasks [can be found here](https://turborepo.com/docs/crafting-your-repository/running-tasks).

More information on filtering [can be found here](https://turborepo.com/docs/reference/run#advanced-filtering-examples).

More information on the terminal UI [can be found here](https://turborepo.com/docs/crafting-your-repository/developing-applications#using-the-terminal-ui).

See the respective packages of this repository for more information.

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
