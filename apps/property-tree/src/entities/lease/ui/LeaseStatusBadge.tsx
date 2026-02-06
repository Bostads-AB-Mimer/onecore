import type { Lease } from '@/services/api/core/lease-service'
import type { components } from '@/services/api/core/generated/api-types'
import { getStatusBadge } from '../lib/status'

type LeaseSearchResult = components['schemas']['LeaseSearchResult']

interface LeaseStatusBadgeProps {
  status: Lease['status'] | LeaseSearchResult['status']
}

export function LeaseStatusBadge({ status }: LeaseStatusBadgeProps) {
  const badge = getStatusBadge(status)
  if (badge) return badge

  return <span className="text-sm text-muted-foreground">{String(status)}</span>
}
