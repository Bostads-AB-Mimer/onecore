import KoaRouter from '@koa/router'
import { keys } from '@onecore/types'
import { registerSchema } from '../../utils/openapi'

import { routes as keyLoanRoutes } from './key-loans'
import { routes as keyRoutes } from './keys'
import { routes as keySystemRoutes } from './key-systems'
import { routes as logRoutes } from './logs'
import { routes as keyNoteRoutes } from './key-notes'
import { routes as receiptRoutes } from './receipts'
import { routes as signatureRoutes } from './signatures'
import { routes as keyEventRoutes } from './key-events'
import { routes as keyBundleRoutes } from './key-bundles'
import { routes as daxRoutes } from './dax'
import { routes as scanReceiptRoutes } from './scan-receipt'

const {
  KeySchema,
  KeyDetailsSchema,
  KeyLoanSchema,
  KeyLoanWithDetailsSchema,
  KeySystemSchema,
  LogSchema,
  KeyNoteSchema,
  KeyBundleSchema,
  KeyBundleDetailsResponseSchema,
  BundleWithLoanedKeysInfoSchema,
  ReceiptSchema,
  KeyEventSchema,
  SignatureSchema,
  CardOwnerSchema,
  CardSchema,
  CardDetailsSchema,
  QueryCardOwnersParamsSchema,
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  BulkUpdateFlexRequestSchema,
  BulkUpdateKeysRequestSchema,
  CreateKeyLoanRequestSchema,
  UpdateKeyLoanRequestSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
  CreateLogRequestSchema,
  CreateKeyNoteRequestSchema,
  UpdateKeyNoteRequestSchema,
  CreateKeyBundleRequestSchema,
  UpdateKeyBundleRequestSchema,
  CreateKeyEventRequestSchema,
  UpdateKeyEventRequestSchema,
  CreateSignatureRequestSchema,
  UpdateSignatureRequestSchema,
  SendSignatureRequestSchema,
  SimpleSignWebhookPayloadSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
  PaginatedResponseSchema,
  CreateReceiptRequestSchema,
  UpdateReceiptRequestSchema,
  ReceiptTypeSchema,
  ReceiptFormatSchema,
  ErrorResponseSchema,
  NotFoundResponseSchema,
  BadRequestResponseSchema,
  SchemaDownloadUrlResponseSchema,
} = keys

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Keys Service
 *     description: Operations related to key management
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Internal server error"
 *     NotFoundResponse:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           example: "Resource not found"
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('Key', KeySchema)
  registerSchema('KeyDetails', KeyDetailsSchema, {
    KeySystem: KeySystemSchema,
    KeyLoan: KeyLoanSchema,
  })
  registerSchema('KeyLoan', KeyLoanSchema)
  registerSchema('KeyLoanWithDetails', KeyLoanWithDetailsSchema)
  registerSchema('KeySystem', KeySystemSchema)
  registerSchema('Log', LogSchema)
  registerSchema('KeyNote', KeyNoteSchema)
  registerSchema('Receipt', ReceiptSchema)
  registerSchema('KeyEvent', KeyEventSchema)
  registerSchema('Signature', SignatureSchema)
  registerSchema('CreateKeyRequest', CreateKeyRequestSchema)
  registerSchema('UpdateKeyRequest', UpdateKeyRequestSchema)
  registerSchema('BulkUpdateFlexRequest', BulkUpdateFlexRequestSchema)
  registerSchema('BulkUpdateKeysRequest', BulkUpdateKeysRequestSchema)
  registerSchema('CreateKeyLoanRequest', CreateKeyLoanRequestSchema)
  registerSchema('UpdateKeyLoanRequest', UpdateKeyLoanRequestSchema)
  registerSchema('CreateKeySystemRequest', CreateKeySystemRequestSchema)
  registerSchema('UpdateKeySystemRequest', UpdateKeySystemRequestSchema)
  registerSchema('CreateLogRequest', CreateLogRequestSchema)
  registerSchema('CreateKeyNoteRequest', CreateKeyNoteRequestSchema)
  registerSchema('UpdateKeyNoteRequest', UpdateKeyNoteRequestSchema)
  registerSchema('KeyBundle', KeyBundleSchema)
  registerSchema('BundleWithLoanedKeysInfo', BundleWithLoanedKeysInfoSchema)
  registerSchema('CreateKeyBundleRequest', CreateKeyBundleRequestSchema)
  registerSchema('UpdateKeyBundleRequest', UpdateKeyBundleRequestSchema)
  registerSchema('KeyBundleDetailsResponse', KeyBundleDetailsResponseSchema, {
    KeyLoan: KeyLoanSchema,
  })
  registerSchema('CreateKeyEventRequest', CreateKeyEventRequestSchema)
  registerSchema('UpdateKeyEventRequest', UpdateKeyEventRequestSchema)
  registerSchema('CreateSignatureRequest', CreateSignatureRequestSchema)
  registerSchema('UpdateSignatureRequest', UpdateSignatureRequestSchema)
  registerSchema('SendSignatureRequest', SendSignatureRequestSchema)
  registerSchema('SimpleSignWebhookPayload', SimpleSignWebhookPayloadSchema)
  registerSchema('CreateReceiptRequest', CreateReceiptRequestSchema)
  registerSchema('UpdateReceiptRequest', UpdateReceiptRequestSchema)
  registerSchema('ReceiptType', ReceiptTypeSchema)
  registerSchema('ReceiptFormat', ReceiptFormatSchema)
  registerSchema('ErrorResponse', ErrorResponseSchema)
  registerSchema('NotFoundResponse', NotFoundResponseSchema)
  registerSchema('BadRequestResponse', BadRequestResponseSchema)
  registerSchema('SchemaDownloadUrlResponse', SchemaDownloadUrlResponseSchema)
  registerSchema('CardOwner', CardOwnerSchema)
  registerSchema('Card', CardSchema)
  registerSchema('CardDetails', CardDetailsSchema)
  registerSchema('QueryCardOwnersParams', QueryCardOwnersParamsSchema)

  // Register pagination schemas
  registerSchema('PaginationMeta', PaginationMetaSchema)
  registerSchema('PaginationLinks', PaginationLinksSchema)
  registerSchema('PaginatedResponse', PaginatedResponseSchema)

  // Mount sub-routers
  keyLoanRoutes(router)
  keyRoutes(router)
  keySystemRoutes(router)
  logRoutes(router)
  keyNoteRoutes(router)
  receiptRoutes(router)
  signatureRoutes(router)
  keyEventRoutes(router)
  keyBundleRoutes(router)
  daxRoutes(router)
  scanReceiptRoutes(router)
}
