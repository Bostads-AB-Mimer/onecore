import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/Command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'

interface SearchableSelectProps<T> {
  /** The options to choose from. */
  items: T[]
  /** Currently selected item, or null when nothing is selected. */
  value: T | null
  /** Called with the chosen item when the user picks one. */
  onChange: (item: T) => void
  /** Stable key per item — used for React keys and selection comparison. */
  getKey: (item: T) => string
  /** Plain-text label, used for the trigger and as the default search text. */
  getLabel: (item: T) => string
  /** Custom rendering of a list row. Defaults to {@link getLabel}. */
  renderItem?: (item: T) => React.ReactNode
  /** Custom rendering of the selected value in the trigger. Defaults to {@link getLabel}. */
  renderValue?: (item: T) => React.ReactNode
  /** Text cmdk filters against. Defaults to {@link getLabel}. */
  getSearchValue?: (item: T) => string
  /** Trigger text shown when nothing is selected. */
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** Forwarded to the trigger button (e.g. to associate a <Label htmlFor>). */
  id?: string
  /** Extra classes for the trigger button. */
  className?: string
  /** Extra classes for the popover content (e.g. a fixed width). */
  contentClassName?: string
}

/**
 * Single-select dropdown with type-to-filter search (shadcn "Combobox" pattern:
 * a Popover trigger with a cmdk Command list inside). Generic over the item type.
 */
export function SearchableSelect<T>({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  renderItem,
  renderValue,
  getSearchValue,
  placeholder = 'Välj...',
  searchPlaceholder = 'Sök...',
  emptyText = 'Inga resultat',
  disabled,
  id,
  className,
  contentClassName,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const selectedKey = value ? getKey(value) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {value ? (renderValue ?? renderItem ?? getLabel)(value) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[--radix-popover-trigger-width] p-0',
          contentClassName
        )}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const key = getKey(item)
                return (
                  <CommandItem
                    key={key}
                    value={(getSearchValue ?? getLabel)(item)}
                    onSelect={() => {
                      onChange(item)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selectedKey === key ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {(renderItem ?? getLabel)(item)}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
