const basePath = __dirname

// apis: [
//   './src/services/property-management-service/index.ts',
//   './src/services/ticketing-service/index.ts',
// ],

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'property-base',
      version: '1.0.0',
    },
  },
  apis: [
    `${basePath}/services/auth-service/*.{ts,js}`,
    `${basePath}/services/health-service/*.{ts,js}`,
    `${basePath}/services/lease-service/*.{ts,js}`,
    `${basePath}/services/property-management-service/*.{ts,js}`,
    `${basePath}/services/ticketing-service/*.{ts,js}`,
  ],
}
