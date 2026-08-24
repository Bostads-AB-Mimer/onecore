import { z } from 'zod'

import {
  ApartmentTemperaturesIntervalSchema,
  ApartmentTemperaturesQuerySchema,
  ApartmentTemperaturePointSchema,
  ApartmentTemperatureSeriesSchema,
  ApartmentTemperaturesResponseSchema,
  CostCenterRefSchema,
  KvvAreaRefSchema,
  KvvAreaWithCostCenterSchema,
  PropertyKvvAreaLookupSchema,
  UpdateMalarEnergiFacilityIdRequestSchema,
  UpdateMalarEnergiFacilityIdResponseSchema,
} from './schema'

export type KvvAreaRef = z.infer<typeof KvvAreaRefSchema>
export type CostCenterRef = z.infer<typeof CostCenterRefSchema>
export type PropertyKvvAreaLookup = z.infer<typeof PropertyKvvAreaLookupSchema>
export type KvvAreaWithCostCenter = z.infer<typeof KvvAreaWithCostCenterSchema>

export type UpdateMalarEnergiFacilityIdRequest = z.infer<
  typeof UpdateMalarEnergiFacilityIdRequestSchema
>

export type UpdateMalarEnergiFacilityIdResponse = z.infer<
  typeof UpdateMalarEnergiFacilityIdResponseSchema
>

export type ApartmentTemperaturesInterval = z.infer<
  typeof ApartmentTemperaturesIntervalSchema
>
export type ApartmentTemperaturesQuery = z.infer<
  typeof ApartmentTemperaturesQuerySchema
>
export type ApartmentTemperaturePoint = z.infer<
  typeof ApartmentTemperaturePointSchema
>
export type ApartmentTemperatureSeries = z.infer<
  typeof ApartmentTemperatureSeriesSchema
>
export type ApartmentTemperaturesResponse = z.infer<
  typeof ApartmentTemperaturesResponseSchema
>
