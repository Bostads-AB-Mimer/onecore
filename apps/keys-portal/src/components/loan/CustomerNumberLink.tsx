import { getTenantViewLink } from '@/utils/externalLinks'

type Props = {
  contactCode: string
  prefix?: string
  className?: string
}

/**
 * Shows a customer number (contactCode) as a link to the customer card in
 * Property Tree. Falls back to plain text when the Property Tree URL is not
 * configured.
 */
export function CustomerNumberLink({
  contactCode,
  prefix,
  className = '',
}: Props) {
  const href = getTenantViewLink(contactCode)
  const text = prefix ? `${prefix} ${contactCode}` : contactCode

  if (!href) {
    return <span className={`text-muted-foreground ${className}`}>{text}</span>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-blue-600 hover:text-blue-800 hover:underline ${className}`}
    >
      {text}
    </a>
  )
}
