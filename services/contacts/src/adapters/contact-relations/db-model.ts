export const ROLE_TYPES = [
  'god_man',
  'forvaltare',
  'annan_fakturamottagare',
] as const

export type RoleType = (typeof ROLE_TYPES)[number]

export type DbContactRelationRow = {
  id: string
  subject_contact_code: string
  related_contact_code: string
  role_type: RoleType
  created_at: Date
  created_by: string
  deleted_at: Date | null
  deleted_by: string | null
}
