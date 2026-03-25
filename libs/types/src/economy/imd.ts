import z from 'zod'

export const IMDRowSchema = z.object({
  rentalObjectCode: z.string().min(1),
  from: z.coerce.date(),
  to: z.coerce.date(),
  unit: z.string().min(1),
  volume: z.coerce.number(),
  cost: z.coerce.number(),
  measurementUnit: z.string().min(1),
})

const EXPECTED_MIN_COLUMNS = 11

export const ProcessIMDRequestSchema = z.object({
  csv: z
    .string()
    .min(1)
    .refine(
      (csv) => {
        const firstLine = csv.trim().split('\n')[0]
        return firstLine.split(';').length >= EXPECTED_MIN_COLUMNS
      },
      {
        message: `CSV must be semicolon-delimited with at least ${EXPECTED_MIN_COLUMNS} columns`,
      }
    ),
})

export const ProcessIMDResponseSchema = z.object({
  totalRows: z.number(),
  numEnriched: z.number(),
  numUnprocessed: z.number(),
  enrichedCsv: z.string(),
  unprocessedCsv: z.string(),
})
