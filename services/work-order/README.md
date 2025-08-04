# Introduction

Microservice for managing work orders in ONECore. This microservice integrates with Odoo (an open-source ERP system) to handle work orders efficiently, allowing us to sync work orders between ONECore and Odoo, retrieve and update work order details, and ensure data consistency across both systems.

## Installation

1. Make a copy of .env.template, call it .env
2. Fill out values in .env. (see below)
3. Install nvm
4. Install required version of node: `nvm install`
5. Use required version of node `nvm use`
6. Install packages: `npm install`
7. Start the application: `npm run build && npm start`

## Development

Start the development server: `npm run dev`

## Testing

To run the test suite, use the following command: `npm run test`

## Env

According to .env.template.

## Swagger

We utilize `swagger-jsdoc` for documenting our API. Each endpoint is required to have appropriate
JSDoc comments and tags for comprehensive documentation. The Swagger document is exposed on `/swagger.json`.

## Routes

### Work Order Service

- **GET /workOrders/contactCode/{contactCode}**

  - Retrieves work orders based on the provided contact code.

- **POST /workOrders**

  - Creates a new work order based on the provided request body.

- **POST /workOrders/{workOrderId}/update**

  - Adds a message to a work order based on the provided work order ID.

- **POST /workOrders/{workOrderId}/close**
  - Closes a work order based on the provided work order ID.

### Health Service

- **GET /health**
  - Retrieves the health status of the system and its subsystems.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
