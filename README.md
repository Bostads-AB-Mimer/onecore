# ONECore

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

