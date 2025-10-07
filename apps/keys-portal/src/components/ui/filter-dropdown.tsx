import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
}

interface FilterDropdownProps {
  options: FilterOption[]
  selectedValue: string | null
  onSelectionChange: (value: string | null) => void
  title?: string
  className?: string
}

export function FilterDropdown({
  options,
  selectedValue,
  onSelectionChange,
  title = 'Filter',
  className,
}: FilterDropdownProps) {
  const hasActiveFilter = selectedValue !== null

  const handleSelect = (value: string) => {
    onSelectionChange(value)
  }

  const handleClearAll = () => {
    onSelectionChange(null)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-2 hover:bg-muted',
            hasActiveFilter && 'text-primary',
            className
          )}
        >
          <Filter
            className={cn('h-3 w-3', hasActiveFilter && 'fill-current')}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup
          value={selectedValue || undefined}
          onValueChange={handleSelect}
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
              onClick={handleClearAll}
            >
              Rensa filter
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
