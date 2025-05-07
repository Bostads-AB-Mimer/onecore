import { z } from 'zod'

export const roomsQueryParamsSchema = z.object({
  residenceId: z.string().min(1, { message: 'residenceId is required.' }),
})

export const RoomTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  use: z.number(),
  optionAllowed: z.number(),
  isSystemStandard: z.number(),
  allowSmallRoomsInValuation: z.number(),
  timestamp: z.string(),
})

export const RoomSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  usage: z.object({
    shared: z.boolean(),
    allowPeriodicWorks: z.boolean(),
    spaceType: z.number(),
  }),
  features: z.object({
    hasToilet: z.boolean(),
    isHeated: z.boolean(),
    hasThermostatValve: z.boolean(),
    orientation: z.number(),
  }),
  dates: z.object({
    installation: z.date().nullable(),
    from: z.date(),
    to: z.date(),
    availableFrom: z.date().nullable(),
    availableTo: z.date().nullable(),
  }),
  sortingOrder: z.number(),
  deleted: z.boolean(),
  timestamp: z.string(),
  roomType: RoomTypeSchema.nullable(),
})

export type Room = z.infer<typeof RoomSchema>
