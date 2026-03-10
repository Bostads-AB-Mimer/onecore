import { keys } from '@onecore/types'
import { z } from 'zod'

export type { AdapterResult } from '../types'

// ---- Type aliases from @onecore/types ----------------------------------------
export type Key = keys.Key
export type KeyDetails = keys.KeyDetails
export type KeyLoan = keys.KeyLoan
export type KeyLoanWithDetails = keys.KeyLoanWithDetails
export type CreateKeyLoanRequest = keys.CreateKeyLoanRequest
export type UpdateKeyLoanRequest = keys.UpdateKeyLoanRequest
export type KeySystem = keys.KeySystem
export type Log = keys.Log
export type CreateLogRequest = keys.CreateLogRequest
export type KeyNote = keys.KeyNote
export type Receipt = keys.Receipt
export type CreateReceiptRequest = keys.CreateReceiptRequest
export type KeyEvent = keys.KeyEvent
export type CreateKeyEventRequest = keys.CreateKeyEventRequest
export type UpdateKeyEventRequest = keys.UpdateKeyEventRequest
export type Signature = keys.Signature
export type SendSignatureRequest = keys.SendSignatureRequest
export type PaginatedResponse<T> = keys.PaginatedResponse<T>
export type KeyBundle = keys.KeyBundle
export type KeyBundleDetailsResponse = keys.KeyBundleDetailsResponse
export type BundleWithLoanedKeysInfo = keys.BundleWithLoanedKeysInfo
export type CardOwner = keys.CardOwner
export type Card = keys.Card
export type CardDetails = keys.CardDetails
export type QueryCardOwnersParams = keys.QueryCardOwnersParams

// ---- Zod schemas used by adapter methods ------------------------------------
export const {
  KeySchema,
  KeyDetailsSchema,
  KeyLoanSchema,
  KeyLoanWithDetailsSchema,
  KeySystemSchema,
  LogSchema,
  ReceiptSchema,
  KeyEventSchema,
  SignatureSchema,
  KeyBundleSchema,
  KeyBundleDetailsResponseSchema,
  BundleWithLoanedKeysInfoSchema,
  KeyNoteSchema,
  CardSchema,
  CardDetailsSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
} = keys

// ---- Shared error type ------------------------------------------------------
export type CommonErr =
  | 'bad-request'
  | 'not-found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'unknown'
