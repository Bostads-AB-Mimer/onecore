import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface SearchInputProps {
  /** Current search query value */
  value: string
  /** Callback when search query changes */
  onChange: (query: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Additional className for the wrapper */
  className?: string
}

/** Search input with icon */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Sök...',
  className = 'max-w-sm',
}: SearchInputProps) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  )
}
