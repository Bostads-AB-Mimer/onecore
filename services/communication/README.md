# ONECore - Communication Microservice

Microservice for communication in ONECore.

## Development

### Requirements

We use pnpm as our package manager: https://pnpm.io/installation

This application requires the following to be installed on your system:

- **nvm**
- **pnpm**
- **Node.js**
- **Docker**

### Install Instructions

#### Prepare environment

Run the `dev:init` script to create a file called `.env`, or manually make a copy of `.env.template`:

```sh
$ pnpm run dev:init
```

Or:

```sh
$ cp .env.template .env
```

#### Install runtime

Install the required node version, if not already installed.

```sh
$ nvm install
```

Activate the required node version.

```sh
$ nvm use
```

#### Install dependencies

Install dependencies

```sh
$ pnpm run install
```

### Running in Development Mode

When all installation steps have been completed and downstreams services are running, a local development instance can be started using:

```sh
$ pnpm run dev
```

### Try out the service

`curl -X POST -H "Content-Type: application/json" -d '{"to":"<email>", "subject":"<subject>", "text":"<text>"}' http://localhost:5040/sendMessage`

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
