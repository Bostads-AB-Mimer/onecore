# Introduction

Core orchestration for Yggdrasil.

## Installation

1. Create the file src/config.json (see below)
3. Install nvm
5. Install required version of node: `nvm install`
6. Use required version of node `nvm use`
7. Install packages: `npm run install`

## Development

Start the development server: `npm run dev`

Note: The microservice yggdrasil-tenants-leases must be running for this application to work.

## Env

config.json template:

```
{
  "port": 5010,
  "tenantsLeasesService": {
    "url": "http://localhost:5020"
  },
  "auth": {
    "testAccount": {
      "userName": "service-account-name",
      "salt": "password salt (create with /auth/generate-hash)",
      "hash": "password hash (create with /auth/generate-hash)"
    }
  }
}
```