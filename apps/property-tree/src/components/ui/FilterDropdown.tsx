import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/DropdownMenu'
import { Input } from '@/components/ui/Input'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
}

interface FilterDropdownProps {
  options: FilterOption[]
  selectedValue: string | null
  onSelectionChange: (value: string | null) => void
  placeholder?: string
  /** Enable search input for filtering options (useful for long lists) */
  searchable?: boolean
  /** Placeholder for search input */
  searchPlaceholder?: string
  className?: string
}

export function FilterDropdown({
  options,
  selectedValue,
  onSelectionChange,
  placeholder = 'Filter...',
  searchable = false,
  searchPlaceholder = 'Sök...',
  className,
}: FilterDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasActiveFilter = selectedValue !== null

  // Filter options based on search query
  const filteredOptions = searchable
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options

  // Focus input when dropdown opens
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearchQuery('')
    }
  }, [open, searchable])

  const handleSelect = (value: string) => {
    onSelectionChange(value)
    setOpen(false)
  }

  const handleClear = () => {
    onSelectionChange(null)
    setOpen(false)
  }

  // For searchable dropdowns, use a custom implementation with better UX
  if (searchable) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 min-w-[130px] px-3 font-semibold justify-between',
              hasActiveFilter && 'text-primary border-primary',
              className
            )}
          >
            <span className="truncate max-w-[150px]">
              {selectedValue || placeholder}
            </span>
            <Filter
              className={cn(
                'h-3 w-3 ml-2 shrink-0',
                hasActiveFilter && 'fill-current'
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-2">
          {/* Search input */}
          <div className="mb-2">
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 text-sm"
            />
          </div>

          {/* Scrollable options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Inga resultat
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent',
                      selectedValue === option.value && 'bg-accent'
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear button */}
          {hasActiveFilter && (
            <>
              <div className="border-t my-2" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-7 justify-start px-2 text-xs"
                onClick={handleClear}
              >
                <X className="h-3 w-3 mr-1" />
                Rensa filter
              </Button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Standard non-searchable dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 min-w-[130px] px-3 font-semibold justify-between',
            hasActiveFilter && 'text-primary border-primary',
            className
          )}
        >
          <span className="truncate">{selectedValue || placeholder}</span>
          <Filter
            className={cn(
              'h-3 w-3 ml-2 shrink-0',
              hasActiveFilter && 'fill-current'
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup
          value={selectedValue || undefined}
          onValueChange={onSelectionChange}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {hasActiveFilter && (
          <>
            <div className="border-t my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 justify-start px-2 text-xs"
              onClick={() => onSelectionChange(null)}
            >
              Rensa filter
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
