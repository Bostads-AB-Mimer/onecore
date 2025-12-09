/**
 * Card Owners resource
 */

import type { DaxClient } from '../client'
import type { CardOwner, QueryCardOwnersParams } from '../types'

export class CardOwnersResource {
  constructor(private client: DaxClient) {}

  /**
   * Query card owners with filters
   */
  async query(params: QueryCardOwnersParams): Promise<{ cardOwners: CardOwner[] }> {
    const { owningPartnerId, owningInstanceId, ...queryParams } = params

    const path = `/partners/${owningPartnerId}/instances/${owningInstanceId}/cardowners`

    return this.client.request('GET', path, { queryParams, context: 'QueryCardOwners' })
  }

  /**
   * Get a specific card owner by ID
   */
  async getById(
    owningPartnerId: string,
    owningInstanceId: string,
    cardOwnerId: string,
    expand?: string,
    context?: string
  ): Promise<{ cardOwner: CardOwner }> {
    const path = `/partners/${owningPartnerId}/instances/${owningInstanceId}/cardowners/${cardOwnerId}`

    return this.client.request('GET', path, {
      queryParams: expand ? { expand } : undefined,
      context,
    })
  }
}
