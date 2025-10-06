# Debt Collection Service Tests

This directory contains test scaffolding for the debt collection service and import script.

## Structure

```
__tests__/
├── __mocks__/
│   ├── @onecore/
│   │   └── utilities.ts          # Mock for logger utilities
│   ├── node:path.ts               # Mock for path module
│   ├── ssh2-sftp-client.ts        # Mock SFTP client
│   └── xpand-db-adapter.ts        # Mock database adapter
├── service.test.ts                # Tests for debt collection service
├── setup.ts                       # Jest test setup
└── test-helpers.ts                # Utility functions for tests

../scripts/__tests__/
├── __mocks__/
│   ├── @onecore/
│   │   └── utilities.ts          # Mock for logger utilities
│   ├── config.ts                  # Mock configuration
│   └── node:path.ts               # Mock for path module
└── import-debt-collection.test.ts # Tests for import script
```

## Mocks

### Database Adapter Mock (`xpand-db-adapter.ts`)

- Provides mock implementations for `getContacts`, `getInvoices`, `getRentalProperties`, `getInvoiceRows`
- Includes factory functions for creating test data
- Supports custom mock data setup via `setupDefaultMocks()` and `resetMocks()`

### SFTP Client Mock (`ssh2-sftp-client.ts`)

- Mock implementation of `ssh2-sftp-client` with all required methods
- Supports file listing, reading, writing, and renaming operations
- Includes helper methods for setting up mock file systems

### Configuration Mock (`config.ts`)

- Provides test configuration values for SFTP connections and directories
- Matches the structure expected by the import script

### Logger Mock (`@onecore/utilities.ts`)

- Mock implementation of the logger utility
- Tracks all log calls for verification in tests
- Includes helper functions to reset and inspect log calls

## Test Helpers

### CSV Generation (`test-helpers.ts`)

- Utilities for creating valid and invalid CSV test data
- Pre-defined sample data for common test scenarios
- Functions for creating CSV content with proper formatting

## Running Tests

```bash
# Run all debt collection tests
npm test -- src/services/debt-collection-service

# Run import script tests
npm test -- src/scripts/__tests__

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm run test:watch
```

## Test Categories

### Service Tests (`service.test.ts`)

1. **CSV Parsing Tests** - Validate CSV import functionality
2. **Data Enrichment Tests** - Test database lookups and data joining
3. **Business Logic Tests** - Test aggregation, payment handling, etc.
4. **Error Handling Tests** - Test various error scenarios

### Import Script Tests (`import-debt-collection.test.ts`)

1. **Configuration Tests** - Validate SFTP and directory configuration
2. **File Discovery Tests** - Test CSV file discovery and filtering
3. **File Processing Tests** - Test the complete file processing workflow
4. **Error Handling Tests** - Test error scenarios and recovery
5. **Logging Tests** - Validate proper logging behavior

## Writing Tests

When writing actual tests, follow these patterns:

### Setting Up Test Data

```typescript
beforeEach(() => {
  setupDefaultMocks()

  // Customize mock data for specific test
  getContacts.mockResolvedValue([
    createMockContact({ contactCode: 'CUSTOM001' }),
  ])
})
```

### Testing Service Functions

```typescript
it('should process valid CSV', async () => {
  const csv = createRentInvoiceCsv([sampleRentInvoiceData])

  const result = await enrichRentInvoices(csv)

  expect(result.ok).toBe(true)
  expect(getContacts).toHaveBeenCalledWith(['CONTACT001'])
  expect(generateInkassoSergelFile).toHaveBeenCalled()
})
```

### Testing Error Scenarios

```typescript
it('should handle missing contacts', async () => {
  getContacts.mockResolvedValue([])

  const csv = createRentInvoiceCsv([sampleRentInvoiceData])

  const result = await enrichRentInvoices(csv)

  expect(result.ok).toBe(false)
  expect(result.error.message).toContain('Contact not found')
})
```

## Notes

- All tests use UTC timezone for consistent date handling
- Console output is mocked to reduce test noise
- Mocks are automatically reset between tests
- Error handling follows the pattern of testing both success and failure paths
- The import script tests assume the script will be refactored to export testable functions
