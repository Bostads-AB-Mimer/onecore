const basePath = __dirname

export const swaggerSpec = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'property-base',
      version: '1.0.0',
    },
    components: {},
  },
  apis: [
    `${basePath}/routes/components.{ts,js}`,
    `${basePath}/routes/residences.{ts,js}`,
    `${basePath}/routes/buildings.{ts,js}`,
    `${basePath}/routes/properties.{ts,js}`,
    `${basePath}/routes/parking-spaces.{ts,js}`,
    `${basePath}/routes/staircases.{ts,js}`,
    `${basePath}/routes/rooms.{ts,js}`,
    `${basePath}/routes/companies.{ts,js}`,
    `${basePath}/routes/maintenance-units.{ts,js}`,
    `${basePath}/routes/facilities.{ts,js}`,
    `${basePath}/routes/health.{ts,js}`,
    `${basePath}/routes/swagger.{ts,js}`,
  ],
}
