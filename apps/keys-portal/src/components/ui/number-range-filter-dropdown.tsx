'use client'

import * as React from 'react'
import { Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface NumberRangeFilterDropdownProps {
  minValue: number | null
  maxValue: number | null
  onRangeChange: (min: number | null, max: number | null) => void
  minLabel?: string
  maxLabel?: string
  className?: string
}

export function NumberRangeFilterDropdown({
  minValue,
  maxValue,
  onRangeChange,
  minLabel = 'Min',
  maxLabel = 'Max',
  className,
}: NumberRangeFilterDropdownProps) {
  const hasActiveFilter = minValue !== null || maxValue !== null

  const [localMin, setLocalMin] = React.useState<string>(
    minValue !== null ? minValue.toString() : ''
  )
  const [localMax, setLocalMax] = React.useState<string>(
    maxValue !== null ? maxValue.toString() : ''
  )

  // Sync local state with props when they change
  React.useEffect(() => {
    setLocalMin(minValue !== null ? minValue.toString() : '')
  }, [minValue])

  React.useEffect(() => {
    setLocalMax(maxValue !== null ? maxValue.toString() : '')
  }, [maxValue])

  const handleApply = () => {
    const min = localMin.trim() ? parseInt(localMin, 10) : null
    const max = localMax.trim() ? parseInt(localMax, 10) : null
    onRangeChange(min, max)
  }

  const handleClearAll = () => {
    setLocalMin('')
    setLocalMax('')
    onRangeChange(null, null)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="number-min" className="text-sm font-medium">
              {minLabel}
            </Label>
            <Input
              id="number-min"
              type="number"
              value={localMin}
              placeholder="Ange minimum"
              className="bg-background"
              onChange={(e) => setLocalMin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApply()
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="number-max" className="text-sm font-medium">
              {maxLabel}
            </Label>
            <Input
              id="number-max"
              type="number"
              value={localMax}
              placeholder="Ange maximum"
              className="bg-background"
              onChange={(e) => setLocalMax(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApply()
                }
              }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleApply}
            >
              Använd
            </Button>
            {hasActiveFilter && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleClearAll}
              >
                Rensa
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
