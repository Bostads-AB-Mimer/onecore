import { TableExternalLink } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getTenantViewLink } from '@/utils/externalLinks'

type Props = {
  contactCode: string
  prefix?: string
  className?: string
}

/**
 * Shows a customer number (contactCode) as a link to the customer card in
 * Property Tree. Falls back to muted plain text when the Property Tree URL is
 * not configured.
 */
export function CustomerNumberLink({ contactCode, prefix, className }: Props) {
  const href = getTenantViewLink(contactCode)
  const text = prefix ? `${prefix} ${contactCode}` : contactCode

  return (
    <TableExternalLink
      href={href}
      className={cn(!href && 'text-muted-foreground', className)}
    >
      {text}
    </TableExternalLink>
  )
}
