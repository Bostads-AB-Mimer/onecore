import type { ReactNode } from 'react'

interface TenantNameProps {
  protectedIdentity?: boolean
  fullName?: string | null
  fallback?: string
  /**
   * Overrides the rendered name when protectedIdentity is false. Use when
   * the name needs to be assembled from multiple fields (e.g. firstName +
   * lastName in the TenantPage header).
   */
  children?: ReactNode
}

/**
 * Renders a contact/tenant name. When protectedIdentity is true the name is
 * replaced by an italic "Skyddad identitet" placeholder — keep callers from
 * having to repeat this conditional in every list cell.
 */
export function TenantName({
  protectedIdentity,
  fullName,
  fallback = '-',
  children,
}: TenantNameProps) {
  if (protectedIdentity) {
    return (
      <span className="italic text-muted-foreground">Skyddad identitet</span>
    )
  }
  if (children !== undefined) {
    return <>{children}</>
  }
  return <>{fullName || fallback}</>
}
