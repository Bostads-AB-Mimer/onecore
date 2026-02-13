# Service Layer Tests

Frontend-specific business logic tests. These do **not** duplicate backend/core test coverage.

Run: `pnpm test` from `apps/keys-portal`

## What's tested

| File                  | Function                             | What it verifies                                                                                                              |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| receiptHandlers       | `categorizeKeys`                     | Disposed keys always go to `disposed` bucket, never `returned`                                                                |
| receiptHandlers       | `categorizeCards`                    | Selected → returned, non-selected → missing                                                                                   |
| receiptHandlers       | `assembleReturnReceipt`              | Empty optional fields are `undefined` (not `[]`); full assembly with partial return                                           |
| receiptHandlers       | `assembleMaintenanceLoanReceipt`     | Contact name fallback chain (fullName → contact code → "Unknown"); description + comment merge                                |
| loanTransferHelpers   | `findExistingActiveLoansForTransfer` | Matches on primary and secondary contact; separates disposed keys from transferable keys                                      |
| leaseSearchService    | `dedupeLeases`                       | Dedup by leaseId, fallback to composite key when leaseId is missing                                                           |
| leaseSearchService    | `equalPnr`                           | 12-digit and 10-digit personnummer comparison (last-10 match)                                                                 |
| logService            | `mapFiltersToQuery`                  | Array filters comma-joined, 3-char minimum on free text, auto-injects `fields` param                                          |
| keySequenceValidation | `parseSequenceNumberInput`           | Valid: empty, single number, ranges up to 20. Invalid: >20, reversed, start<1, non-numeric                                    |
| lease-status          | `deriveDisplayStatus`                | Date-based priority (lastDebitDate → ended, future start → upcoming), backend status fallback, "abouttoend" treated as active |

# I could
