# dax-client

TypeScript client for the Amido DAX API with OAuth and RSA signature authentication.
This is a third party applcation, any issues regarding the DAX API should be directed to Amido, for example at support@amido.se

## Installation

```bash
npm install dax-client
# or
pnpm add dax-client
```

## Usage

```typescript
import { createDaxClient } from 'dax-client'
import fs from 'fs'

// Create client
const client = createDaxClient({
  apiUrl: 'https://api-prod.dax.amido.io',
  clientId: 'your-client-id',
  username: 'your-username',
  password: 'your-password',
  privateKey: fs.readFileSync('./path/to/private.pem', 'utf8'),
  apiVersion: '2.0', // optional, defaults to '2.0'
})

// Currently implemented methods

// Get contracts
const { contracts } = await client.contracts.getAll()

// Query card owners
const { cardOwners } = await client.cardOwners.query({
  owningPartnerId: 'partner-id',
  owningInstanceId: 'instance-id',
  nameFilter: 'John',
  expand: 'cards',
  limit: 50,
})

// Get specific card owner
const { cardOwner } = await client.cardOwners.getById(
  'partner-id',
  'instance-id',
  'cardowner-id',
  'cards' // expand parameter
)

// Get specific card
const { card } = await client.cards.getById(
  'partner-id',
  'instance-id',
  'card-id',
  'codes' // expand parameter
)
```

## Features

- ✅ OAuth 2.0 authentication with token caching
- ✅ RSA signature authentication (SHA256withRSA)
- ✅ Type-safe API with TypeScript
- ✅ Zero external dependencies (only Node.js built-ins)
- ✅ Resource-based API organization

## API

### Contracts

- `client.contracts.getAll()` - Get all contracts, useful for testing that auth is working correctly

### Card Owners

- `client.cardOwners.query(params)` - Query card owners with filters
  - Supports: `nameFilter`, `expand`, `idfilter`, `attributeFilter`, `selectedAttributes`, `folderFilter`, `organisationFilter`
- `client.cardOwners.getById(partnerId, instanceId, cardOwnerId, expand?)` - Get specific card owner
  - `expand` parameter: e.g., `'cards'` to include related cards

### Cards

- `client.cards.getById(partnerId, instanceId, cardId, expand?)` - Get specific card
  - `expand` parameter: e.g., `'codes'` to include card codes

## Configuration

```typescript
interface DaxClientConfig {
  apiUrl: string // DAX API base URL
  clientId: string // OAuth client ID
  username: string // OAuth username
  password: string // OAuth password
  privateKey: string // RSA private key (PEM format)
  apiVersion?: string // API version (default: '2.0')
}
```

## License

MIT
