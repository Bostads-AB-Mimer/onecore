/**
 * Cards resource
 */

import type { DaxClient } from '../client'
import type { Card } from '../types'

export class CardsResource {
  constructor(private client: DaxClient) {}

  /**
   * Get a specific card by ID
   */
  async getById(
    owningPartnerId: string,
    owningInstanceId: string,
    cardId: string,
    expand?: string,
    context?: string
  ): Promise<{ card: Card }> {
    const path = `/partners/${owningPartnerId}/instances/${owningInstanceId}/cards/${cardId}`

    return this.client.request('GET', path, {
      queryParams: expand ? { expand } : undefined,
      context,
    })
  }
}
