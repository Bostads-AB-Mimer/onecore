# Introduction

Microservice for communication in ONECore.

## Installation

1. Fill out values in src/common/config.ts
2. Use required version of node `nvm use`
3. Install packages: `npm install`

## Development

Start the development server: `npm run dev`

### Try out the service

`curl -X POST -H "Content-Type: application/json" -d '{"to":"<email>", "subject":"<subject>", "text":"<text>"}' http://localhost:5040/sendMessage`

## Env

According to .env.template.
