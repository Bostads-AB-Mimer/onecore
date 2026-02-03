# ONECore - File Storage Service

Microservice for managing file storage in ONECore using MinIO as the storage backend.

## Overview

The File Storage Service provides a REST API for managing files in a MinIO object storage system. It supports uploading, downloading, listing, and deleting files, as well as generating presigned URLs and retrieving file metadata.

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Koa
- **Storage Backend**: MinIO (S3-compatible object storage)
- **API Documentation**: Swagger (OpenAPI 3.0)

### Swagger

We utilize `swagger-jsdoc` for documenting our API. Each endpoint is required to have appropriate
JSDoc comments and tags for comprehensive documentation.

- **Swagger UI**: Available at `/swagger`
- **Swagger JSON**: Available at `/swagger.json`

### Routes

#### File Storage Service

- **GET /files**
  - List files with optional prefix filter
  - Query parameter: `prefix` (optional) - Filter files by prefix

- **POST /files/upload**
  - Upload a file to storage
  - Request body: `{ fileName: string, fileData: string (base64), contentType: string }`

- **GET /files/:fileName**
  - Download a file as a stream
  - Returns the file with appropriate content-type and content-disposition headers

- **GET /files/:fileName/url**
  - Generate a presigned URL for file download
  - Query parameter: `expirySeconds` (optional, default: 3600) - URL expiration time

- **GET /files/:fileName/metadata**
  - Get file metadata (size, etag, last modified date)

- **GET /files/:fileName/exists**
  - Check if a file exists in storage

- **DELETE /files/:fileName**
  - Delete a file from storage

#### Health Service

- **GET /health**
  - Retrieves the health status of the system and its subsystems

## Development

### Requirements

This application requires the following to be installed on your system:

- **nvm**
- **pnpm**
- **Node.js**
- **Docker** (for running MinIO)

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

Configure the following environment variables in your `.env` file:

```env
ELASTICSEARCH_LOGGING_HOST=http://localhost:9208
APPLICATION_NAME=file-storage

# MinIO Configuration
MINIO__ENDPOINT=localhost
MINIO__PORT=9000
MINIO__USE_SSL=false
MINIO__ACCESS_KEY=minio
MINIO__SECRET_KEY=minio123
MINIO__BUCKET_NAME=onecore-documents
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
$ pnpm install
```

### Running in Development Mode

#### Start MinIO

Before running the service, ensure MinIO is running. If using Docker Compose from the project root:

```sh
$ docker-compose up -d minio
```

MinIO will be available at `http://localhost:9000` (API) and `http://localhost:9001` (Console).

#### Start the service

When all installation steps have been completed and downstream services are running, a local development instance can be started using:

```sh
$ pnpm run dev
```

The service will be available at `http://localhost:5091` (or the configured port).

- **API**: `http://localhost:5091`
- **Swagger UI**: `http://localhost:5091/swagger`
- **Swagger JSON**: `http://localhost:5091/swagger.json`

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
