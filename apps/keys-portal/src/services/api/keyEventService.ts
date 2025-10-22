import type {
  KeyEvent,
  CreateKeyEventRequest,
  UpdateKeyEventRequest,
} from '@/services/types'

import { GET, POST, PATCH } from './core/base-api'

export const keyEventService = {
  /**
   * Get all key events
   */
  async getAll(): Promise<KeyEvent[]> {
    const { data, error } = await GET('/key-events', {})
    if (error) throw error
    return (data?.content ?? []) as KeyEvent[]
  },

  /**
   * Get a single key event by ID
   */
  async get(id: string): Promise<KeyEvent> {
    const { data, error } = await GET('/key-events/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as KeyEvent
  },

  /**
   * Get all key events for a specific key
   * @param keyId - The key ID to filter by
   * @param limit - Optional limit (use 1 to get only latest event)
   */
  async getByKeyId(keyId: string, limit?: number): Promise<KeyEvent[]> {
    const { data, error } = await GET('/key-events/by-key/{keyId}', {
      params: {
        path: { keyId },
        query: limit ? { limit: limit.toString() } : {},
      },
    })
    if (error) throw error
    return (data?.content ?? []) as KeyEvent[]
  },

  /**
   * Get the latest event for a specific key
   * Returns undefined if no events exist for the key
   */
  async getLatestForKey(keyId: string): Promise<KeyEvent | undefined> {
    const events = await this.getByKeyId(keyId, 1)
    return events[0]
  },

  /**
   * Get the latest events for multiple keys
   * Returns a Map of keyId -> latest KeyEvent (or undefined if no event)
   */
  async getLatestForKeys(
    keyIds: string[]
  ): Promise<Map<string, KeyEvent | undefined>> {
    const eventMap = new Map<string, KeyEvent | undefined>()

    // Fetch latest event for each key in parallel
    await Promise.all(
      keyIds.map(async (keyId) => {
        const latestEvent = await this.getLatestForKey(keyId)
        eventMap.set(keyId, latestEvent)
      })
    )

    return eventMap
  },

  /**
   * Create a new key event
   */
  async create(payload: CreateKeyEventRequest): Promise<KeyEvent> {
    const { data, error } = await POST('/key-events', { body: payload })
    if (error) throw error
    return data?.content as KeyEvent
  },

  /**
   * Update an existing key event
   */
  async update(id: string, payload: UpdateKeyEventRequest): Promise<KeyEvent> {
    const { data, error } = await PATCH('/key-events/{id}', {
      params: { path: { id } },
      body: payload,
    })
    if (error) throw error
    return data?.content as KeyEvent
  },

  /**
   * Helper to create a FLEX event with ORDERED status
   */
  async createFlexOrder(
    keyIds: string[],
    workOrderId?: string
  ): Promise<KeyEvent> {
    return this.create({
      keys: JSON.stringify(keyIds),
      type: 'FLEX',
      status: 'ORDERED',
      workOrderId: workOrderId ?? null,
    })
  },

  /**
   * Helper to create an ORDER event with ORDERED status
   */
  async createKeyOrder(
    keyIds: string[],
    workOrderId?: string
  ): Promise<KeyEvent> {
    return this.create({
      keys: JSON.stringify(keyIds),
      type: 'ORDER',
      status: 'ORDERED',
      workOrderId: workOrderId ?? null,
    })
  },

  /**
   * Helper to update an event status
   */
  async updateStatus(
    eventId: string,
    status: 'ORDERED' | 'RECEIVED' | 'COMPLETED'
  ): Promise<KeyEvent> {
    return this.update(eventId, { status })
  },
}
