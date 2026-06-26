import type {
  RelatedContact,
  RelatedContactRole,
  Tenant,
} from '@/services/types'

// Both directions collapse to the same label.
export const RELATED_CONTACT_ROLE_LABELS: Record<RelatedContactRole, string> = {
  trustee: 'God man',
  trusteeFor: 'God man',
  administrator: 'Förvaltare',
  administratorFor: 'Förvaltare',
  otherInvoiceRecipient: 'Annan fakturamottagare',
  otherInvoiceRecipientFor: 'Annan fakturamottagare',
}

// Reverse roles get a "för" suffix.
export const RELATED_CONTACT_GROUP_LABELS: Record<RelatedContactRole, string> =
  {
    trustee: 'God man',
    administrator: 'Förvaltare',
    otherInvoiceRecipient: 'Annan fakturamottagare',
    trusteeFor: 'God man för',
    administratorFor: 'Förvaltare för',
    otherInvoiceRecipientFor: 'Annan fakturamottagare för',
  }

const INCOMING_ROLES: RelatedContactRole[] = [
  'trustee',
  'administrator',
  'otherInvoiceRecipient',
]

const REVERSE_ROLES: RelatedContactRole[] = [
  'trusteeFor',
  'administratorFor',
  'otherInvoiceRecipientFor',
]

export const RELATED_CONTACT_GROUP_ORDER: RelatedContactRole[] = [
  ...INCOMING_ROLES,
  ...REVERSE_ROLES,
]

export const getContactRoleTitle = (
  tenant: Pick<Tenant, 'isTenant'>,
  relatedContacts: RelatedContact[]
): string => {
  const titles: string[] = []
  if (tenant.isTenant) titles.push('Hyresgäst')
  for (const role of REVERSE_ROLES) {
    if (relatedContacts.some((rc) => rc.role === role)) {
      titles.push(RELATED_CONTACT_ROLE_LABELS[role])
    }
  }
  return titles.length > 0 ? titles.join(' / ') : 'Kontakt'
}

export const getIncomingRelationSummary = (
  relatedContacts: RelatedContact[]
): string => {
  return INCOMING_ROLES.filter((role) =>
    relatedContacts.some((rc) => rc.role === role)
  )
    .map((role) => RELATED_CONTACT_ROLE_LABELS[role])
    .join(', ')
}
