# ONECore - Communication Microservice

Microservice for communication in ONECore.


## Development

### Requirements

This application requires the following to be installed on your system:


 * **nvm**
 * **npm**
 * **Node.js**
 * **Docker**

### Install Instructions

#### Prepare environment

Run the `dev:init` script to create a file called `.env`, or manually make a copy of `.env.template`:


```sh
$ npm run dev:init
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
$ npm run install
```

### Running in Development Mode

When all installation steps have been completed and downstreams services are running, a local development instance can be started using:


```sh
$ npm run dev
```

### Try out the service

`curl -X POST -H "Content-Type: application/json" -d '{"to":"<email>", "subject":"<subject>", "text":"<text>"}' http://localhost:5040/sendMessage`


## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)

