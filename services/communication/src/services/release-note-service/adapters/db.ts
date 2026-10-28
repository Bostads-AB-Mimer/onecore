import { communication } from '@onecore/types'

import { db } from '../../../common/db'

type ReleaseNote = communication.ReleaseNote
type ReleaseNoteApp = communication.ReleaseNoteApp
type CreateReleaseNoteParams = communication.CreateReleaseNoteParams
type UpdateReleaseNote = communication.UpdateReleaseNote

const TABLE = 'release_note'

export type ListReleaseNotesOptions = {
  app?: ReleaseNoteApp
  includeDrafts?: boolean
}

// Pinned first, then newest. Drafts have no publishedAt and sort by createdAt.
export async function listReleaseNotes(
  options: ListReleaseNotesOptions = {}
): Promise<ReleaseNote[]> {
  const query = db<ReleaseNote>(TABLE)

  if (options.app) {
    query.where('app', options.app)
  }

  // A future publishedAt is a scheduled note: hidden until that time passes.
  if (!options.includeDrafts) {
    query.whereNotNull('publishedAt').where('publishedAt', '<=', new Date())
  }

  return query
    .orderBy('pinned', 'desc')
    .orderByRaw('COALESCE(publishedAt, createdAt) DESC')
}

export async function getReleaseNoteById(
  id: string
): Promise<ReleaseNote | null> {
  const note = await db<ReleaseNote>(TABLE).where('id', id).first()
  return note ?? null
}

export async function createReleaseNote(
  params: CreateReleaseNoteParams
): Promise<ReleaseNote> {
  const [created] = await db(TABLE)
    .insert({
      app: params.app,
      title: params.title,
      description: params.description,
      category: params.category,
      pinned: params.pinned ?? false,
      publishedAt: params.publishedAt ?? null,
      createdBy: params.createdBy ?? null,
    })
    .returning<ReleaseNote[]>('*')

  return created
}

// Only keys present in `params` are written. Returns null when id is unknown.
export async function updateReleaseNote(
  id: string,
  params: UpdateReleaseNote
): Promise<ReleaseNote | null> {
  const [updated] = await db(TABLE)
    .where('id', id)
    .update({ ...params, updatedAt: new Date() })
    .returning<ReleaseNote[]>('*')

  return updated ?? null
}

export async function deleteReleaseNote(id: string): Promise<boolean> {
  const deletedCount = await db(TABLE).where('id', id).delete()
  return deletedCount > 0
}
