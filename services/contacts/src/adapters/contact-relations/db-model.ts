export const ROLE_TYPES = [
  'god_man',
  'forvaltare',
  'annan_fakturamottagare',
] as const

export type RoleType = (typeof ROLE_TYPES)[number]

/**
 * The roles a contact may hold only one of at a time, enforced by
 * `ux_contact_relation_active_guardian`. The live write rules and the offline
 * import both key off this — spelling it out twice lets them disagree about
 * which roles are exclusive, and the import is the half that rarely runs.
 */
export const GUARDIAN_ROLE_TYPES = ['god_man', 'forvaltare'] as const

export const isGuardianRole = (roleType: RoleType): boolean =>
  (GUARDIAN_ROLE_TYPES as readonly RoleType[]).includes(roleType)

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
