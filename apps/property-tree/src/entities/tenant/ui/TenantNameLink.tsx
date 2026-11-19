import { Link } from 'react-router-dom'

import { paths } from '@/shared/routes'

type Props = {
  contactCode: string | null
  /** From contacts; null for a protected identity or when contacts failed. */
  fullName: string | null
  /** A muted line under the link, e.g. the personnummer. */
  detail?: string
}

/** The tenant's name as a link to the tenant, else the contact code, else -. */
export function TenantNameLink({ contactCode, fullName, detail }: Props) {
  if (!contactCode) return <span className="text-muted-foreground">-</span>
  return (
    <div>
      <Link
        to={paths.tenant(contactCode)}
        className="font-medium text-primary hover:underline"
      >
        {fullName || contactCode}
      </Link>
      {detail && <div className="text-sm text-muted-foreground">{detail}</div>}
    </div>
  )
}
