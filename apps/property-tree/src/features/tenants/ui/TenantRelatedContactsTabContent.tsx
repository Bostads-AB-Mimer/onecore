import { Link } from 'react-router-dom'

import {
  formatTenantName,
  RELATED_CONTACT_GROUP_LABELS,
  RELATED_CONTACT_GROUP_ORDER,
  useRelatedContacts,
} from '@/entities/tenant'

import type { RelatedContact } from '@/services/types'

import { paths } from '@/shared/routes'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

interface TenantRelatedContactsTabContentProps {
  contactCode: string
}

export function TenantRelatedContactsTabContent({
  contactCode,
}: TenantRelatedContactsTabContentProps) {
  const { data, isLoading, error } = useRelatedContacts(contactCode)
  const relations = data ?? []

  const groups = RELATED_CONTACT_GROUP_ORDER.map((role) => ({
    role,
    label: RELATED_CONTACT_GROUP_LABELS[role],
    contacts: relations.filter((rc) => rc.role === role),
  })).filter((group) => group.contacts.length > 0)

  return (
    <TabLayout
      title="Relaterade kontakter"
      showCard={true}
      isLoading={isLoading}
      error={error as Error | null}
      errorMessage="Kunde inte ladda relaterade kontakter"
    >
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-center py-4 text-sm">
          Inga relaterade kontakter
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.role} className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.contacts.map((contact: RelatedContact) => (
                  <div key={`${group.role}-${contact.contactCode}`}>
                    <Link
                      to={paths.tenant(contact.contactCode)}
                      className="font-medium text-primary hover:underline"
                    >
                      {formatTenantName(contact)}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      {contact.contactCode}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </TabLayout>
  )
}
