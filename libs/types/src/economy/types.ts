import { z } from 'zod'
import {
  OpenInvoiceStateSchema,
  OpenInvoiceSchema,
  OpenInvoicesErrorCodeSchema,
} from './schema'

export type OpenInvoiceState = z.infer<typeof OpenInvoiceStateSchema>
export type OpenInvoice = z.infer<typeof OpenInvoiceSchema>
export type OpenInvoicesErrorCode = z.infer<typeof OpenInvoicesErrorCodeSchema>
