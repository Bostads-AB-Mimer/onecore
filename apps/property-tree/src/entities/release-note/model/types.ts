import type { components } from '@/services/api/core/generated/api-types'

export type ReleaseNote = components['schemas']['ReleaseNote']
export type ReleaseNoteCategory = ReleaseNote['category']
export type ReleaseNoteApp = ReleaseNote['app']
export type CreateReleaseNote = components['schemas']['CreateReleaseNote']
export type UpdateReleaseNote = components['schemas']['UpdateReleaseNote']
