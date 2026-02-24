// services/api/keyNoteService.ts
import type {
  KeyNote,
  CreateKeyNoteRequest,
  UpdateKeyNoteRequest,
} from '@/services/types'

import { GET, POST, PUT } from './core/base-api'

export const keyNoteService = {
  /**
   * Get all key notes by rental object code
   */
  async getKeyNotesByRentalObjectCode(
    rentalObjectCode: string
  ): Promise<KeyNote[]> {
    const { data, error } = await GET(
      '/key-notes/by-rental-object/{rentalObjectCode}',
      {
        params: { path: { rentalObjectCode } },
      }
    )
    if (error) throw error
    return (data?.content ?? []) as KeyNote[]
  },

  /**
   * Get a single key note by ID
   */
  async getKeyNote(id: string): Promise<KeyNote> {
    const { data, error } = await GET('/key-notes/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as KeyNote
  },

  /**
   * Create a new key note
   */
  async createKeyNote(payload: CreateKeyNoteRequest): Promise<KeyNote> {
    const { data, error } = await POST('/key-notes', { body: payload })
    if (error) throw error
    return data?.content as KeyNote
  },

  /**
   * Update an existing key note
   */
  async updateKeyNote(
    id: string,
    payload: UpdateKeyNoteRequest
  ): Promise<KeyNote> {
    const { data, error } = await PUT('/key-notes/{id}', {
      params: { path: { id } },
      body: payload,
    })
    if (error) throw error
    return data?.content as KeyNote
  },
}
