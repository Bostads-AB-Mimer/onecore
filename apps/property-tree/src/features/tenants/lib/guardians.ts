import type {
  RelationErrorCode,
  RelationRoleType,
} from '@/services/api/core/tenantService'
import type { RelatedContactRole } from '@/services/types'

/** The two roles this dialog offers. Annan fakturamottagare is AVTAL-176. */
export const GUARDIAN_ROLE_TYPES = ['god_man', 'forvaltare'] as const
export type GuardianRoleType = (typeof GUARDIAN_ROLE_TYPES)[number]

export const GUARDIAN_ROLE_LABELS: Record<GuardianRoleType, string> = {
  god_man: 'God man',
  forvaltare: 'Förvaltare',
}

/** The stored role type behind a forward relation as seen from the subject. */
export const ROLE_TYPE_FOR_RELATED_ROLE: Partial<
  Record<RelatedContactRole, RelationRoleType>
> = {
  trustee: 'god_man',
  administrator: 'forvaltare',
  otherInvoiceRecipient: 'annan_fakturamottagare',
}

export const hasGuardian = (
  relations: { role: RelatedContactRole }[]
): boolean =>
  relations.some((r) => r.role === 'trustee' || r.role === 'administrator')

export const relationErrorMessage = (
  error: RelationErrorCode | undefined,
  detail?: string
): string => {
  switch (error) {
    case 'guardian-exists':
      return detail
        ? `Kontakten har redan en god man eller förvaltare (${detail}). Ta bort den befintliga först.`
        : 'Kontakten har redan en god man eller förvaltare. Ta bort den befintliga först.'
    case 'duplicate-relation':
      return 'Relationen finns redan.'
    case 'self-relation':
      return 'En kontakt kan inte vara sin egen god man eller förvaltare.'
    case 'subject-not-found':
      return 'Kontakten hittades inte.'
    case 'related-not-found':
      return 'Den valda kontakten hittades inte.'
    case 'relation-not-found':
      return 'Relationen är redan borttagen.'
    // Bugs or upstream failures: nothing the caseworker can act on.
    case 'invalid-request':
    case 'contacts-service-error':
    default:
      return 'Något gick fel. Försök igen.'
  }
}
