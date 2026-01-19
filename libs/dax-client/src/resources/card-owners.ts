/**
 * Card Owners resource
 */

import type { DaxClient } from '../client'
import type { CardOwner, CardOwnerQueryParams } from '../types'

export class CardOwnersResource {
  constructor(private client: DaxClient) {}

  /**
   * Query card owners with filters
   */
  async query(params?: CardOwnerQueryParams): Promise<{ cardOwners: CardOwner[] }> {
    const path = `/partners/${this.client.partnerId}/instances/${this.client.instanceId}/cardowners`

    return this.client.request('GET', path, {
      queryParams: params ? { ...params } : undefined,
      context: 'QueryCardOwners',
    })
  }

  /**
   * Get a specific card owner by ID
   */
  async getById(
    cardOwnerId: string,
    expand?: string,
    context?: string
  ): Promise<{ cardOwner: CardOwner }> {
    const path = `/partners/${this.client.partnerId}/instances/${this.client.instanceId}/cardowners/${cardOwnerId}`

    return this.client.request('GET', path, {
      queryParams: expand ? { expand } : undefined,
      context,
    })
  }
}
