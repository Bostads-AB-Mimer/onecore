'use client'

import { Filter, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface NullableFilterValue {
  hasValue: boolean | null // null = all, true = has value, false = no value
}

interface DualNullableFilterDropdownProps {
  label1: string
  label2: string
  value1: NullableFilterValue
  value2: NullableFilterValue
  onChange1: (value: NullableFilterValue) => void
  onChange2: (value: NullableFilterValue) => void
  className?: string
}

export function DualNullableFilterDropdown({
  label1,
  label2,
  value1,
  value2,
  onChange1,
  onChange2,
  className,
}: DualNullableFilterDropdownProps) {
  const hasActiveFilter = value1.hasValue !== null || value2.hasValue !== null

  const handleSelect1Has = () => {
    onChange1({ hasValue: value1.hasValue === true ? null : true })
  }

  const handleSelect1No = () => {
    onChange1({ hasValue: value1.hasValue === false ? null : false })
  }

  const handleSelect2Has = () => {
    onChange2({ hasValue: value2.hasValue === true ? null : true })
  }

  const handleSelect2No = () => {
    onChange2({ hasValue: value2.hasValue === false ? null : false })
  }

  const handleClearAll = () => {
    onChange1({ hasValue: null })
    onChange2({ hasValue: null })
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
        {/* Group 1 options */}
        <button
          onClick={handleSelect1Has}
          className={cn(
            'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
            value1.hasValue === true && 'bg-accent'
          )}
        >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            {value1.hasValue === true && <Check className="h-4 w-4" />}
          </span>
          <span className="pl-6">Upphämtad</span>
        </button>
        <button
          onClick={handleSelect1No}
          className={cn(
            'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
            value1.hasValue === false && 'bg-accent'
          )}
        >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            {value1.hasValue === false && <Check className="h-4 w-4" />}
          </span>
          <span className="pl-6">Ej upphämtad</span>
        </button>

        {/* Separator */}
        <div className="border-t my-1" />

        {/* Group 2 options */}
        <button
          onClick={handleSelect2Has}
          className={cn(
            'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
            value2.hasValue === true && 'bg-accent'
          )}
        >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            {value2.hasValue === true && <Check className="h-4 w-4" />}
          </span>
          <span className="pl-6">Återlämnad</span>
        </button>
        <button
          onClick={handleSelect2No}
          className={cn(
            'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
            value2.hasValue === false && 'bg-accent'
          )}
        >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            {value2.hasValue === false && <Check className="h-4 w-4" />}
          </span>
          <span className="pl-6">Ej återlämnad</span>
        </button>

        {/* Clear button */}
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
