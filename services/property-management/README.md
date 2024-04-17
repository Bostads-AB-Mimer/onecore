# Introduction

Microservice for property management in ONECore.

## Installation

1. Make a copy of .env.template, call it .env
2. Fill out values in .env. (see below)
3. Install nvm
4. Install required version of node: `nvm install`
5. Use required version of node `nvm use`
6. Install packages: `npm install`
7. Start database engine (SQL Server): `docker compose up -d &`
8. Create a database called `property-info`
9. Create database structure: `npm run migrate:up`
10. Create test data: `npm run seed`

## Development

Start the development server: `npm run dev`

## Env

According to .env.template.
