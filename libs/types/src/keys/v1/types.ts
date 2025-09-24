import { z } from 'zod'
import {
  KeyTypeSchema,
  KeySystemTypeSchema,
  // Main entity schemas
  KeySchema,
  KeyLoanSchema,
  KeySystemSchema,
  LogSchema,
    // Request schemas
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
  CreateKeyLoanRequestSchema,
  UpdateKeyLoanRequestSchema,
  CreateLogRequestSchema,
  UpdateLogRequestSchema,
} from './schema'

// Enum types
export type KeyType = z.infer<typeof KeyTypeSchema>
export type KeySystemType = z.infer<typeof KeySystemTypeSchema>

// Main entity types
export type Key = z.infer<typeof KeySchema>
export type KeyLoan = z.infer<typeof KeyLoanSchema>
export type KeySystem = z.infer<typeof KeySystemSchema>
export type Log = z.infer<typeof LogSchema>

// Request types for keys
export type CreateKeyRequest = z.infer<typeof CreateKeyRequestSchema>
export type UpdateKeyRequest = z.infer<typeof UpdateKeyRequestSchema>

// Request types for key systems
export type CreateKeySystemRequest = z.infer<typeof CreateKeySystemRequestSchema>
export type UpdateKeySystemRequest = z.infer<typeof UpdateKeySystemRequestSchema>

// Request types for key loans
export type CreateKeyLoanRequest = z.infer<typeof CreateKeyLoanRequestSchema>
export type UpdateKeyLoanRequest = z.infer<typeof UpdateKeyLoanRequestSchema>

// Request types for logs
export type CreateLogRequest = z.infer<typeof CreateLogRequestSchema>
export type UpdateLogRequest = z.infer<typeof UpdateLogRequestSchema>