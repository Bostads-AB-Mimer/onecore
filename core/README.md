# Introduction

Core orchestration for ONECore.

## Installation

1. Create the file src/config.json (see below)
2. Install nvm
3. Install required version of node: `nvm install`
4. Use required version of node `nvm use`
5. Install packages: `npm run install`

## Development

Start the development server: `npm run dev`

Note: The microservices leasing and property-management must be running for this application to work.

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
