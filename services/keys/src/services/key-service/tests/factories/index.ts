/**
 * Test data factories for keys service.
 *
 * Factories use the Fishery library to generate test data with sensible defaults.
 * This allows tests to be more readable and maintainable.
 *
 * Usage in tests:
 * import * as factory from './factories'
 *
 * const key = factory.key.build()
 * const keys = factory.key.buildList(5)
 * const customKey = factory.key.build({ keyName: 'Master Key' })
 *
 * const keyLoan = factory.keyLoan.build()
 * const keyLoanWithMultipleKeys = factory.keyLoan.build({
 *   keys: JSON.stringify(['key-1', 'key-2'])
 * })
 */

export { KeyFactory as key } from './key'
export { KeyLoanFactory as keyLoan } from './key-loan'
export { KeySystemFactory as keySystem } from './key-system'
export { ReceiptFactory as receipt } from './receipt'
export { LogFactory as log } from './log'
export { KeyNoteFactory as keyNote } from './key-note'
