# Introduction

Backend for the coworker portal for Mimer.

## Installation

1. Make a copy of .env.template, call it .env
2. Fill out values in .env. (see below)
3. Install nvm
5. Install required version of node: `nvm install`
6. Use required version of node `nvm use`
7. Install packages: `npm run install`

## Development

Start the development server: `npm run dev`

Note: You need to have yggdrasil-core running for this application to work.

## Env

* CORE__URL - Url to yggdrasil-core
* CORE__USERNAME - User name for service account in yggdrasil-core (configured in that application)
* CORE__PASSWORD - Password for service account in yggdrasil-core (configured in that application)
* AUTH__COOKIE_DOMAIN - Set to "localhost" for local dev environment
* AUTH__TEST_ACCOUNT__ID - National registration number of a contact present in the database for yggdrasil-tenants-leases
* AUTH__TEST_ACCOUNT__USERNAME - Login username for the (currently only) user in the portal
* AUTH__TEST_ACCOUNT__SALT - Salt for portal user (create with /auth/generate-hash)
* AUTH__TEST_ACCOUNT__HASH - Password hash for user (create with /auth/generate-hash)
