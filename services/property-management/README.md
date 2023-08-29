# Introduction

Microservice for property information in Yggdrasil.

## Installation

1. Make a copy of .env.template, call it .env
2. Fill out values in .env. (see below)
3. Install nvm
5. Install required version of node: `nvm install`
6. Use required version of node `nvm use`
7. Install packages: `npm run install`
8. Start database engine (SQL Server): `docker compose up -d &`
9. Create a database called `properties`
10. Create database structure: `npm run migrate:up`
11. Create test data: `npm run seed`

## Development

Start the development server: `npm run dev`

## Env

* DATABASE__PASSWORD - password for database
* DATABASE__HOST - "localhost" for local dev environment
* DATABASE__USER - database username, default "sa"
* DATABASE__DATABASE=properties
* DATABASE__PORT=1433
