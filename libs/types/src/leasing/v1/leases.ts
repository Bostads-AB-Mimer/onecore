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
    .default('false')
    .transform((value) => value === 'true'),
})

export const IncludeRentalObjectQueryParamSchema = z.object({
  includeRentalObject: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
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
).merge(IncludeRentalObjectQueryParamSchema)

export const GetLeaseOptionsSchema = IncludeContactsQueryParamSchema.merge(
  IncludeRentalObjectQueryParamSchema
)

export type GetLeasesOptions = z.infer<typeof GetLeasesOptionsSchema>

export type GetLeaseOptions = z.infer<typeof GetLeaseOptionsSchema>
