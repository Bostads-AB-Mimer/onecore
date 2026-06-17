import { Link } from 'react-router-dom'

import { cn } from '@/shared/lib/utils'
import { paths } from '@/shared/routes'

import { ProtectedIdentityBadge } from './ProtectedIdentityBadge'
import { TenantName } from './TenantName'

interface TenantNameLinkProps {
  contactCode: string
  fullName?: string | null
  protectedIdentity?: boolean
  fallback?: string
  className?: string
  badgeSize?: 'sm' | 'md'
}

/**
 * Renders a tenant name as a link to the kundkort (when the contact code
 * starts with P/F) plus the skyddad-identitet badge inline. Replaces the
 * link/span branching and badge wiring that was duplicated across the lease
 * list tabs and the lease/contract search results.
 */
export function TenantNameLink({
  contactCode,
  fullName,
  protectedIdentity,
  fallback,
  className,
  badgeSize = 'sm',
}: TenantNameLinkProps) {
  const isValidContact =
    contactCode.startsWith('P') || contactCode.startsWith('F')
  const nameNode = (
    <TenantName
      fullName={fullName}
      protectedIdentity={protectedIdentity}
      fallback={fallback}
    />
  )

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {isValidContact ? (
        <Link
          to={paths.tenant(contactCode)}
          className="font-medium text-primary hover:underline"
        >
          {nameNode}
        </Link>
      ) : (
        <span className="font-medium">{nameNode}</span>
      )}
      {protectedIdentity && <ProtectedIdentityBadge size={badgeSize} />}
    </span>
  )
}
