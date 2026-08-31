---
name: property-tree
description: >
  Use when working on the property-tree frontend app (apps/property-tree).
  Provides domain context: what the app is, who uses it, the property hierarchy,
  Swedish terminology mappings, external system integrations, and feature domain
  descriptions. Use this to understand the purpose and domain of property-tree
  before making changes.
---

# Property-Tree — Domain Context

Property-tree is an internal web application used by Bostads AB Mimer's property management staff. It is the primary tool for looking up and managing properties, buildings, residences, customers, leases, inspections, work orders, and related data.

## ONECore Frontend Landscape

Property-tree is one of three frontends in the ONECore platform:

- **property-tree** — property and customer management (this app)
- **internal-portal** — managing new leases
- **keys-portal** — managing physical keys

All three consume data exclusively through **core** (port 5010), which acts as the orchestration/gateway layer. Core sometimes proxies requests directly to a microservice, and sometimes aggregates data from multiple microservices. Property-tree never talks to microservices directly.

## Domain Model

The core domain follows a hierarchical structure:

```
Property (fastighet)
├── Building (byggnad)
│   ├── Staircase / Entrance (uppgång)
│   │   ├── Residence / Apartment (bostad/lägenhet)
│   │   │   └── Room (rum)
│   │   └── Facility / Commercial premises (lokal)
│   └── Maintenance Unit (underhållsenhet)
└── Parking Space (bilplats)
```

- **Customers** (hyresgäster in code) are linked to residences, facilities, and parking spaces via **Leases** (hyreskontrakt). The codebase uses "tenants" but this is a misnomer — it includes both active tenants and people in the rental queue who are not yet tenants. The correct term is "customers."
- **Rental Blocks** (spärrar) are residences marked as unavailable for rent, still administered in Xpand.

Cross-cutting domains that apply across the hierarchy:

- **Inspections** (besiktningar) — property/residence inspections
- **Work Orders** — maintenance errands, integrated with Odoo
- **Documents** — file attachments
- **Components** — building component tracking (installations, maintenance)
- **Economy** — handles redovisning; in property-tree this means viewing customer payments and invoices

## Swedish Terminology

| Swedish (in code/URLs) | English | Notes |
|---|---|---|
| Fastighet | Property | Real estate unit |
| Byggnad | Building | |
| Uppgång | Staircase / entrance | |
| Bostad / Lägenhet | Residence / Apartment | |
| Lokal | Facility / Commercial premises | |
| Rum | Room | |
| Hyresgäst | Customer | Codebase says "tenant" but includes queue applicants |
| Hyreskontrakt | Lease | |
| Bilplats | Parking space | |
| Underhållsenhet | Maintenance unit | |
| Besiktning | Inspection | |
| Spärr | Rental block | Residence unavailable for rent |
| Fastighetssök | Property search | |
| Redovisning | Accounting / financial reporting | |
| Rondering | Round / patrol inspection | |

## External Systems & Integrations

| System | Role | Integration |
|---|---|---|
| **Xpand** | Legacy property management system | ONECore reads from its database during migration. Some data may move to other sources over time, but property-tree is unaffected since it always consumes through core. |
| **Core** | Sole API gateway (port 5010) | All property-tree API calls go through core. Never bypassed. |
| **Keycloak** | OAuth 2.0 authentication | Redirect-based auth flow with token exchange |
| **Odoo** | Work order system | Used standalone and integrated via the work-order microservice to view errands |
| **Greenview** | External system for ronderingar | Linked to externally from property-tree |
| **Passage** | External system for keys/access | Linked to externally from property-tree |
| **XLedger, TenFast, Curves** | Third-party integrations | Linked to externally |

## Feature Domains

| Domain | Description |
|---|---|
| **auth** | Keycloak OAuth flow, login, callbacks |
| **properties** | Property search and listings |
| **buildings** | Building details and entrances |
| **residences** | Apartment/residence management |
| **rooms** | Room details within residences |
| **facilities** | Commercial premises management |
| **parking-spaces** | Parking space management |
| **maintenance-units** | Maintenance unit tracking |
| **tenants** | Customer profiles and contacts (includes queue applicants, not just active tenants) |
| **leases** | Lease search, filtering, bulk actions, export |
| **inspections** | Inspection records |
| **work-orders** | Maintenance errands, integrated with Odoo |
| **documents** | File upload and storage |
| **components** | Building component tracking (installations, maintenance) |
| **component-library** | Component type catalogue |
| **economy** | Customer payments and invoices (redovisning) |
| **rental-blocks** | Residences blocked from renting (from Xpand) |
| **companies** | Company/organization information |
| **search** | Global command palette search |
