import { Link } from 'react-router-dom'

interface SelectableCardLinkProps {
  href: string
  /** Override navigation, e.g. to open the target inside a sheet. */
  onSelect?: () => void
  children: React.ReactNode
}

/** Wraps a card in a link to `href`, optionally overriding navigation. */
export function SelectableCardLink({
  href,
  onSelect,
  children,
}: SelectableCardLinkProps) {
  // Stays an anchor even when overridden, so the card remains a real link
  // (middle-click, open in new tab) and keeps valid markup around the card.
  if (onSelect) {
    return (
      <a
        href={href}
        onClick={(event) => {
          // Let the browser handle modifier- and non-primary-button clicks so
          // the card can still be opened in a new tab or window.
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button !== 0
          ) {
            return
          }
          event.preventDefault()
          onSelect()
        }}
        className="block rounded-lg"
      >
        {children}
      </a>
    )
  }

  return (
    <Link to={href} className="block rounded-lg">
      {children}
    </Link>
  )
}
