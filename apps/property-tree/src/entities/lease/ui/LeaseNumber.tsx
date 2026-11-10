import type { ReactNode } from 'react'

import { ExternalLeaseLink } from './ExternalLeaseLink'

interface LeaseNumberProps {
  children: ReactNode
  externalUrl?: string
}

/** Lease number followed by a link to the lease in Tenfast, when available. */
export function LeaseNumber({ children, externalUrl }: LeaseNumberProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <ExternalLeaseLink url={externalUrl} />
    </span>
  )
}
