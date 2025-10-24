import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  loading?: boolean
  placeholder?: string
  title?: string
  description?: string
  helpText?: React.ReactNode
}

/**
 * Reusable search input component for visual presentation.
 * Contains no search logic - that's handled by parent components.
 */
export function SearchInput({
  value,
  onChange,
  onSearch,
  loading = false,
  placeholder = 'Sök...',
  title = 'Sök',
  description,
  helpText,
}: SearchInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={onSearch} className="gap-2" disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Söker…' : 'Sök'}
          </Button>
        </div>
        {helpText && (
          <div className="text-sm text-muted-foreground space-y-1">
            {helpText}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
