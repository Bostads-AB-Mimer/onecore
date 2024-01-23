# Introduction

Backend for the coworker portal for Mimer.
The frontend is packages/frontend in this repo.

## Installation

1. Make a copy of .env.template, call it .env
2. Fill out values in .env. (see below)
3. Install nvm
4. Install required version of node: `nvm install`
5. Use required version of node `nvm use`
6. Install packages: `npm install`

## Development

Start the development server: `npm run dev`

Note: You need to have yggdrasil-core running for this application to work.

## Env

* CORE__URL - Url to yggdrasil-core
* CORE__USERNAME - Username for service account in yggdrasil-core (configured in that application)
* CORE__PASSWORD - Password for service account in yggdrasil-core (configured in that application)
* AUTH__COOKIE_DOMAIN - Set to "localhost" for local dev environment
* MSAL__ CLOUD_INSTANCE="https://login.microsoftonline.com/" # cloud instance string should end with a trailing slash
* MSAL__TENANT_ID - your Azure tenant id.
* MSAL__CLIENT_ID - client id for your Azure App Registration / Enterprise Application
* MSAL__CLIENT_SECRET - client secret generated for your Azure App Registration / Enterprise Application
* MSAL__REDIRECT_URI="http://localhost:7000/api/auth/redirect" - absolute uri for the redirect post route, i.e. hostname + '/api/auth/redirect'
* MSAL__POST_LOGOUT_REDIRECT_URI="http://localhost:7000" - absolute uri for where the user is redirected after logout
* MSAL__GRAPH_API_ENDPOINT="https://graph.microsoft.com/" # graph api endpoint string should end with a trailing slash
