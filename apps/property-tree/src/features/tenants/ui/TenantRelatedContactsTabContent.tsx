import { Link } from 'react-router-dom'

import {
  formatTenantName,
  RELATED_CONTACT_GROUP_LABELS,
  RELATED_CONTACT_GROUP_ORDER,
  useRelatedContacts,
} from '@/entities/tenant'
import { CONTACT_CREATE_ROLE, RequireRole } from '@/entities/user'

import type { RelatedContact } from '@/services/types'

import { paths } from '@/shared/routes'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { hasGuardian, ROLE_TYPE_FOR_RELATED_ROLE } from '../lib/relations'
import { AddGuardianDialog } from './AddGuardianDialog'
import { RemoveRelationButton } from './RemoveRelationButton'

interface TenantRelatedContactsTabContentProps {
  contactCode: string
}

export function TenantRelatedContactsTabContent({
  contactCode,
}: TenantRelatedContactsTabContentProps) {
  const { data, isLoading, error } = useRelatedContacts(contactCode)
  const relations = data ?? []

  // A contact can only have one god man or förvaltare at a time.
  const canAddGuardian = !hasGuardian(relations)

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
      <RequireRole roles={[CONTACT_CREATE_ROLE]}>
        {canAddGuardian && (
          <div className="flex justify-end mb-4">
            <AddGuardianDialog contactCode={contactCode} />
          </div>
        )}
      </RequireRole>
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-center py-4 text-sm">
          Inga relaterade kontakter
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            // Only the forward roles map to a stored role type — the reverse
            // groups ("God man för") are administered from the other kundkort.
            const roleType = ROLE_TYPE_FOR_RELATED_ROLE[group.role]
            const removable =
              roleType === 'god_man' || roleType === 'forvaltare'

            return (
              <div key={group.role} className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">
                  {group.label}
                </h4>
                <div className="space-y-1">
                  {group.contacts.map((contact: RelatedContact) => (
                    <div
                      key={`${group.role}-${contact.contactCode}`}
                      className="flex items-start justify-between gap-2"
                    >
                      <div>
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
                      {removable && (
                        <RequireRole roles={[CONTACT_CREATE_ROLE]}>
                          <RemoveRelationButton
                            contactCode={contactCode}
                            relatedContactCode={contact.contactCode}
                            relatedName={formatTenantName(contact)}
                            roleType={roleType}
                            roleLabel={group.label}
                          />
                        </RequireRole>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </TabLayout>
  )
}
