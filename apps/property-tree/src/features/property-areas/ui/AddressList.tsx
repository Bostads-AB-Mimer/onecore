import { useState } from 'react'

interface AddressListProps {
  addresses: string[]
  className?: string
}

export function AddressList({ addresses, className }: AddressListProps) {
  const [expanded, setExpanded] = useState(false)

  if (addresses.length === 0) return null

  const wrapperClass = `text-xs text-muted-foreground break-words ${className ?? ''}`

  if (addresses.length === 1) {
    return <div className={wrapperClass}>{addresses[0]}</div>
  }

  if (!expanded) {
    const extra = addresses.length - 1
    return (
      <div className={wrapperClass}>
        {addresses[0]}{' '}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-primary hover:underline"
        >
          och {extra} {extra === 1 ? 'till' : 'fler'}
        </button>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <ul className="space-y-0.5">
        {addresses.map((a, i) => (
          <li key={`${a}-${i}`}>{a}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="text-primary hover:underline mt-1"
      >
        Visa mindre
      </button>
    </div>
  )
}
