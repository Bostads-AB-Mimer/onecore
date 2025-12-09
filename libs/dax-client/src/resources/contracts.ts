/**
 * Contracts resource
 */

import type { DaxClient } from '../client'
import type { Contract } from '../types'

export class ContractsResource {
  constructor(private client: DaxClient) {}

  /**
   * Get all contracts
   */
  async getAll(context?: string): Promise<{ contracts: Contract[] }> {
    return this.client.request('GET', '/contracts', { context })
  }
}
