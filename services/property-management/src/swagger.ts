const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'onecore-property-management',
      version: '1.0.0',
    },
  },
  apis: [
    `${basePath}/services/health-service/*.{ts,js}`,
    `${basePath}/services/property-info-service/*.{ts,js}`,
  ],
}
