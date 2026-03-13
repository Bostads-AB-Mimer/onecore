import { useEffect, useRef, useState } from 'react'
import { Filter, X } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'
import { Input } from '@/shared/ui/Input'

interface FilterOption {
  label: string
  value: string
}

interface MultiSelectFilterDropdownProps {
  options: FilterOption[]
  selectedValues: string[]
  onSelectionChange: (values: string[]) => void
  placeholder?: string
  /** Enable search input for filtering options (useful for long lists) */
  searchable?: boolean
  /** Placeholder for search input */
  searchPlaceholder?: string
  className?: string
}

export function MultiSelectFilterDropdown({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = 'Filter...',
  searchable = false,
  searchPlaceholder = 'Sök...',
  className,
}: MultiSelectFilterDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasActiveFilter = selectedValues.length > 0

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

  const handleToggle = (value: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedValues, value])
    } else {
      onSelectionChange(selectedValues.filter((v) => v !== value))
    }
  }

  const handleClear = () => {
    onSelectionChange([])
  }

  // Get display text for button
  const getButtonText = () => {
    if (selectedValues.length === 0) return placeholder
    if (selectedValues.length === 1) {
      return (
        options.find((o) => o.value === selectedValues[0])?.label ??
        selectedValues[0]
      )
    }
    return `${placeholder} +${selectedValues.length}`
  }

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
          <span className="truncate max-w-[150px]">{getButtonText()}</span>
          <Filter
            className={cn(
              'h-3 w-3 ml-2 shrink-0',
              hasActiveFilter && 'fill-current'
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {/* Search input */}
        {searchable && (
          <div className="p-2 pb-1">
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Options list */}
        {filteredOptions.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Inga resultat
          </div>
        ) : (
          filteredOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedValues.includes(option.value)}
              onCheckedChange={(checked) =>
                handleToggle(option.value, checked === true)
              }
              onSelect={(e) => e.preventDefault()}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}

        {/* Clear button */}
        {hasActiveFilter && (
          <>
            <div className="border-t my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 justify-start px-2 text-xs"
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
