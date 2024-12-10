const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'onecore-work-order',
      version: '1.0.0',
    },
  },
  apis: [
    `${basePath}/services/health-service/*.{ts,js}`,
    `${basePath}/services/work-order-service/*.{ts,js}`,
  ],
}
