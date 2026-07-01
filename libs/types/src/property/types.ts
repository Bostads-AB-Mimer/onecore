import { z } from 'zod'

import {
  ApartmentTemperaturesIntervalSchema,
  ApartmentTemperaturesQuerySchema,
  ApartmentTemperaturePointSchema,
  ApartmentTemperatureSeriesSchema,
  ApartmentTemperaturesResponseSchema,
  UpdateMalarEnergiFacilityIdRequestSchema,
} from './schema'

export type UpdateMalarEnergiFacilityIdRequest = z.infer<
  typeof UpdateMalarEnergiFacilityIdRequestSchema
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
