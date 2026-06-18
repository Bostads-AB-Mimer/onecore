import { z } from 'zod'

import {
  ApartmentTemperaturesIntervalSchema,
  ApartmentTemperaturesQuerySchema,
  ApartmentTemperaturePointSchema,
  ApartmentTemperatureSeriesSchema,
  ApartmentTemperaturesResponseSchema,
  AnalyzeComponentImageRequestSchema,
  AIComponentAnalysisSchema,
} from './schema'

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
export type AnalyzeComponentImageRequest = z.infer<
  typeof AnalyzeComponentImageRequestSchema
>
export type AIComponentAnalysis = z.infer<typeof AIComponentAnalysisSchema>
