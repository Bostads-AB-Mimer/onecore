import z from 'zod'

export const GetLeasesStatusSchema = z.enum([
  'current',
  'upcoming',
  'about-to-end',
  'ended',
])

export const IncludeContactsQueryParamSchema = z.object({
  includeContacts: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

export const IncludeRentInfoQueryParamSchema = z.object({
  includeRentInfo: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value !== 'false'), // defaults to true
})

export const FilterLeasesQueryParamsSchema = z.object({
  status: z
    .string()
    .nonempty()
    .describe(
      `Comma-separated list of statuses to include leases by. Valid values are ${GetLeasesStatusSchema.options.join(', ')}. Default is all statuses.`
    )
    .refine(
      (value) =>
        value
          .split(',')
          .every((v) => GetLeasesStatusSchema.safeParse(v.trim()).success),
      {
        message: `Status must be one or more of ${GetLeasesStatusSchema.options.join(', ')}`,
      }
    )
    .transform((value) =>
      value
        .split(',')
        .map((v) => v.trim() as z.infer<typeof GetLeasesStatusSchema>)
    )
    .optional(),
})

export const GetLeasesOptionsSchema = FilterLeasesQueryParamsSchema.merge(
  IncludeContactsQueryParamSchema
).merge(IncludeRentInfoQueryParamSchema)

export const GetLeaseOptionsSchema = IncludeContactsQueryParamSchema

export const PreliminaryTerminateLeaseRequestSchema = z.object({
  contactCode: z.string(),
  lastDebitDate: z.string().datetime(),
  desiredMoveDate: z.string().datetime(),
})

export const PreliminaryTerminateLeaseResponseSchema = z.object({
  message: z.string(),
})

export const AddLeaseHomeInsuranceRequestSchema = z.object({
  from: z.coerce.date(),
})
