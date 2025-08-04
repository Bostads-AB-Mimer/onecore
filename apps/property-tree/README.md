# ONECore - Property Management Portal Application

## Development

### Requirements

This application requires the following to be installed on your system:


 * **npm**
 * **Node.js**
 * **Docker**

### Install Instructions

#### Prepare environment

Run the `dev:init` script to create a file called `.env`, or manually make a copy of `.env.local.example`:


```sh
$ npm run dev:init
```

Or:


```sh
$ cp .env.template .env
```

#### Install dependencies

Install dependencies


```sh
$ npm run install
```

### Running in Development Mode

When all installation steps have been completed and downstreams services are running, a local development instance can be started using:


```sh
$ npm run dev
```

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)

