# ONECore

[![CI](https://github.com/Bostads-AB-Mimer/onecore/actions/workflows/lint.yaml/badge.svg)](https://github.com/Bostads-AB-Mimer/onecore/actions/workflows/lint.yaml)
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

See the respective packages of this repository for more information.


## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)

