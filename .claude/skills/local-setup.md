---
name: local-setup
description: >
  Use when running onecore services or apps locally, looking up which port a
  service or app listens on, opening a service's Swagger UI, or when a task
  touches another repository (onecore-odoo, the ops repos for the dev, stage
  and production clusters, or mimer.nu's API and Webbappar in Azure DevOps)
  and you need to know where it lives and how epics map across repos.
---

# Local Setup and Related Repositories

## Running Locally

`pnpm dev` (Turborepo) starts everything; filter with `pnpm dev -- --filter='@onecore/leasing'`. Infrastructure (SQL Server, Elasticsearch, Kibana, MinIO) runs from `docker-compose.yaml` — start Docker first.

Default ports:

| Service             | Port |     | App                          | Port          |
| ------------------- | ---- | --- | ---------------------------- | ------------- |
| core                | 5010 |     | internal-portal backend      | 7001          |
| leasing             | 5020 |     | internal-portal frontend     | 7003          |
| property-management | 5030 |     | leasing-portal BFF (uth-345) | 7002          |
| communication       | 5040 |     | keys-portal, property-tree   | 3000 (`PORT`) |
| property            | 5050 |     |                              |               |
| work-order          | 5070 |     |                              |               |
| economy             | 5080 |     |                              |               |
| inspection          | 5090 |     |                              |               |
| file-storage        | 5091 |     |                              |               |
| keys                | 5092 |     |                              |               |
| contacts            | 5093 |     |                              |               |

Each service's Swagger UI is at `http://localhost:<port>/swagger`.

## Related Repositories

| Repo                                            | Where                               | What                                                                                                                                               |
| ----------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onecore` (this, **public**)                    | GitHub `Bostads-AB-Mimer`           | Core, services, apps                                                                                                                               |
| `onecore-odoo` (public)                         | GitHub                              | Odoo case management; calls core                                                                                                                   |
| `mimer-onecore-operations` (private)            | GitHub                              | Flux/Kustomize config for the dev cluster (one environment per epic, e.g. `epic-avtal-49`) and the test cluster (stage). PRs go to `refactor/dev`. |
| `mimer-onecore-operations-production` (private) | GitHub                              | Same for production                                                                                                                                |
| `API`, `Webbappar` (mimer.nu)                   | Azure DevOps `mimeronline/Mimer.nu` | mimer.nu's .NET API and the Vue apps Sök ledigt and Mina sidor. Maintained by another vendor.                                                      |

A feature that spans repos uses the same epic name in each (e.g. `epic/avtal-49-…` in onecore and onecore-odoo, `epic/avtal-49-start-using-tenfast` in mimer.nu), and they are released together.
