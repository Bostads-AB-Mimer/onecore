/**
 * DAX Client - TypeScript client for the Amido DAX API
 */

import { DaxClient } from './client'
import { ContractsResource } from './resources/contracts'
import { CardOwnersResource } from './resources/card-owners'
import type { DaxClientConfig } from './types'

// Export types
export * from './types'

// Export individual resources and client for advanced usage
export { DaxClient } from './client'
export { ContractsResource } from './resources/contracts'
export { CardOwnersResource } from './resources/card-owners'

/**
 * Main DAX API client with resource accessors
 */
export class Dax {
  private client: DaxClient

  public readonly contracts: ContractsResource
  public readonly cardOwners: CardOwnersResource

  constructor(config: DaxClientConfig) {
    this.client = new DaxClient(config)
    this.contracts = new ContractsResource(this.client)
    this.cardOwners = new CardOwnersResource(this.client)
  }
}

/**
 * Create a new DAX client instance
 */
export function createDaxClient(config: DaxClientConfig): Dax {
  return new Dax(config)
}

// Default export
export default Dax
