import KoaRouter from '@koa/router'
import swaggerJsdoc from 'swagger-jsdoc'
import zodToJsonSchema from 'zod-to-json-schema'

import * as types from '@src/types'

import { swaggerSpec } from '../swagger'

const schemas = {
  ...zodToJsonSchema(types.ResidenceSchema, {
    name: 'Residence',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.ResidenceDetailedSchema, {
    name: 'ResidenceDetails',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.ResidenceSearchResultSchema, {
    name: 'ResidenceSearchResult',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.BuildingSchema, {
    name: 'Building',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.ComponentSchema, {
    name: 'Component',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.PropertySchema, {
    name: 'Property',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.PropertyDetailsSchema, {
    name: 'PropertyDetails',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.StaircaseSchema, {
    name: 'Staircase',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.RoomSchema, {
    name: 'Room',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.CompanySchema, {
    name: 'Company',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.CompanyDetailsSchema, {
    name: 'CompanyDetails',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.MaintenanceUnitSchema, {
    name: 'MaintenanceUnit',
  }).definitions,
  ...zodToJsonSchema(types.ResidenceByRentalIdSchema, {
    name: 'ResidenceByRentalId',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.GetResidenceByRentalIdResponseSchema, {
    name: 'GetResidenceByRentalIdResponse',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.ParkingSpaceSchema, {
    name: 'ParkingSpace',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.FacilityDetailsSchema, {
    name: 'FacilityDetails',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.GetFacilityByRentalIdResponseSchema, {
    name: 'GetFacilityByRentalIdResponse',
    target: 'openApi3',
  }).definitions,
}

swaggerSpec.definition.components = {
  ...swaggerSpec.definition.components,
  schemas,
}

const swaggerOptions = swaggerJsdoc(swaggerSpec)

export const routes = (router: KoaRouter) => {
  router.get('/swagger.json', async (ctx) => {
    ctx.set('Content-Type', 'application/json')
    ctx.body = swaggerOptions
  })
}
