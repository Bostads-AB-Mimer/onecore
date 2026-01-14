import z from 'zod'

export const RentArticleSchema = z.record(z.string(), z.any())
