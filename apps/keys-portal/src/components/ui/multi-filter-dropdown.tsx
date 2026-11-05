import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterOption<T extends string> {
  label: string
  value: T
}

interface MultiFilterDropdownProps<T extends string> {
  options: FilterOption<T>[]
  selectedValues: T[]
  onSelectionChange: (values: T[]) => void
  className?: string
}

/** Checkbox variant of FilterDropdown: any number of options, empty = no filter */
export function MultiFilterDropdown<T extends string>({
  options,
  selectedValues,
  onSelectionChange,
  className,
}: MultiFilterDropdownProps<T>) {
  const hasActiveFilter = selectedValues.length > 0

  // Keep the options' order so the URL does not depend on click order
  const toggle = (value: T, checked: boolean) =>
    onSelectionChange(
      options
        .map((o) => o.value)
        .filter((v) => (v === value ? checked : selectedValues.includes(v)))
    )

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
      <DropdownMenuContent align="start" className="w-56">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked)}
            // Keep the menu open so several options can be picked in one go
            onSelect={(e) => e.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {hasActiveFilter && (
          <>
            <div className="border-t my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 justify-start px-2 text-xs"
              onClick={() => onSelectionChange([])}
            >
              Rensa filter
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
