import { RELATED_CONTACT_GROUP_LABELS } from '@/entities/tenant'

import type {
  RelationErrorCode,
  RelationRoleType,
} from '@/services/api/core/tenantService'
import type { RelatedContactRole } from '@/services/types'

const GUARDIAN_ROLE_TYPES: RelationRoleType[] = ['god_man', 'forvaltare']

/** Single-sourced with the group headings the list is rendered under. */
export const RELATION_ROLE_LABELS: Record<RelationRoleType, string> = {
  god_man: RELATED_CONTACT_GROUP_LABELS.trustee,
  forvaltare: RELATED_CONTACT_GROUP_LABELS.administrator,
  annan_fakturamottagare: RELATED_CONTACT_GROUP_LABELS.otherInvoiceRecipient,
}

/** The stored role type behind a forward relation as seen from the subject. */
export const ROLE_TYPE_FOR_RELATED_ROLE: Partial<
  Record<RelatedContactRole, RelationRoleType>
> = {
  trustee: 'god_man',
  administrator: 'forvaltare',
  otherInvoiceRecipient: 'annan_fakturamottagare',
}

const hasGuardian = (relations: { role: RelatedContactRole }[]): boolean =>
  relations.some((r) => r.role === 'trustee' || r.role === 'administrator')

/**
 * Which roles can still be added to this contact. At most one guardian, so
 * both guardian roles drop out once either is set; a contact may hold several
 * fakturamottagare, and the same one twice is refused as duplicate-relation.
 * Empty is impossible today — fakturamottagare is always addable — but the
 * caller still hides the button on empty rather than assuming.
 */
export const addableRoleTypes = (
  relations: { role: RelatedContactRole }[]
): RelationRoleType[] =>
  hasGuardian(relations)
    ? ['annan_fakturamottagare']
    : [...GUARDIAN_ROLE_TYPES, 'annan_fakturamottagare']

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
    // Bugs or upstream failures: nothing the caseworker can act on. Every such
    // code is listed, so `default` only catches an unset or future code.
    case 'invalid-request':
    case 'invalid-role-type':
    case 'missing-deleted-by':
    case 'contacts-service-error':
    default:
      return 'Något gick fel. Försök igen.'
  }
}
