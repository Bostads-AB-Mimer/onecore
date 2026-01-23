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
  ...zodToJsonSchema(types.ResidenceSummarySchema, {
    name: 'ResidenceSummary',
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
  ...zodToJsonSchema(types.ParkingSpaceSearchResultSchema, {
    name: 'ParkingSpaceSearchResult',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.FacilityDetailsSchema, {
    name: 'FacilityDetails',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.FacilitySearchResultSchema, {
    name: 'FacilitySearchResult',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.GetFacilityByRentalIdResponseSchema, {
    name: 'GetFacilityByRentalIdResponse',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.GetFacilitiesByPropertyCodeResponseSchema, {
    name: 'GetFacilitiesByPropertyCodeResponse',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.GetFacilitiesByBuildingCodeResponseSchema, {
    name: 'GetFacilitiesByBuildingCodeResponse',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.RentalBlockSchema, {
    name: 'RentalBlock',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.RentalBlockWithRentalObjectSchema, {
    name: 'RentalBlockWithRentalObject',
    target: 'openApi3',
  }).definitions,
  ...zodToJsonSchema(types.ComponentCategorySchema, {
    name: 'ComponentCategory',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.CreateComponentCategorySchema, {
    name: 'CreateComponentCategoryRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.UpdateComponentCategorySchema, {
    name: 'UpdateComponentCategoryRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.ComponentTypeSchema, {
    name: 'ComponentType',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.ComponentSubtypeSchema, {
    name: 'ComponentSubtype',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.ComponentModelSchema, {
    name: 'ComponentModel',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.ComponentSchema, {
    name: 'Component',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.ComponentInstallationSchema, {
    name: 'ComponentInstallation',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.CreateComponentTypeSchema, {
    name: 'CreateComponentTypeRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.UpdateComponentTypeSchema, {
    name: 'UpdateComponentTypeRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.CreateComponentSubtypeSchema, {
    name: 'CreateComponentSubtypeRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.UpdateComponentSubtypeSchema, {
    name: 'UpdateComponentSubtypeRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.CreateComponentModelSchema, {
    name: 'CreateComponentModelRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.UpdateComponentModelSchema, {
    name: 'UpdateComponentModelRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.CreateComponentSchema, {
    name: 'CreateComponentRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.UpdateComponentSchema, {
    name: 'UpdateComponentRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.CreateComponentInstallationSchema, {
    name: 'CreateComponentInstallationRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.UpdateComponentInstallationSchema, {
    name: 'UpdateComponentInstallationRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.DocumentSchema, {
    name: 'Document',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.DocumentWithUrlSchema, {
    name: 'DocumentWithUrl',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.AnalyzeComponentImageRequestSchema, {
    name: 'AnalyzeComponentImageRequest',
    target: 'openApi3',
    $refStrategy: 'none',
  }).definitions,
  ...zodToJsonSchema(types.AIComponentAnalysisSchema, {
    name: 'AIComponentAnalysis',
    target: 'openApi3',
    $refStrategy: 'none',
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
