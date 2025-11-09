'use client'

import * as React from 'react'
import { Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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

  // Local state for both filters
  const [localValue1, setLocalValue1] = React.useState<string>(
    value1.hasValue === null ? 'all' : value1.hasValue ? 'has-value' : 'no-value'
  )
  const [localValue2, setLocalValue2] = React.useState<string>(
    value2.hasValue === null ? 'all' : value2.hasValue ? 'has-value' : 'no-value'
  )

  // Sync local state with props when they change
  React.useEffect(() => {
    setLocalValue1(
      value1.hasValue === null
        ? 'all'
        : value1.hasValue
          ? 'has-value'
          : 'no-value'
    )
  }, [value1.hasValue])

  React.useEffect(() => {
    setLocalValue2(
      value2.hasValue === null
        ? 'all'
        : value2.hasValue
          ? 'has-value'
          : 'no-value'
    )
  }, [value2.hasValue])

  const handleApply = () => {
    const hasValue1 =
      localValue1 === 'all' ? null : localValue1 === 'has-value' ? true : false
    const hasValue2 =
      localValue2 === 'all' ? null : localValue2 === 'has-value' ? true : false

    onChange1({ hasValue: hasValue1 })
    onChange2({ hasValue: hasValue2 })
  }

  const handleClearAll = () => {
    setLocalValue1('all')
    setLocalValue2('all')
    onChange1({ hasValue: null })
    onChange2({ hasValue: null })
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
        <div className="space-y-6">
          {/* Filter 1 */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">{label1}</Label>
            <RadioGroup value={localValue1} onValueChange={setLocalValue1}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id={`${label1}-all`} />
                <Label htmlFor={`${label1}-all`} className="font-normal">
                  Visa alla
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="has-value" id={`${label1}-has`} />
                <Label htmlFor={`${label1}-has`} className="font-normal">
                  Har datum
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no-value" id={`${label1}-no`} />
                <Label htmlFor={`${label1}-no`} className="font-normal">
                  Inget datum
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Filter 2 */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">{label2}</Label>
            <RadioGroup value={localValue2} onValueChange={setLocalValue2}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id={`${label2}-all`} />
                <Label htmlFor={`${label2}-all`} className="font-normal">
                  Visa alla
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="has-value" id={`${label2}-has`} />
                <Label htmlFor={`${label2}-has`} className="font-normal">
                  Har datum
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no-value" id={`${label2}-no`} />
                <Label htmlFor={`${label2}-no`} className="font-normal">
                  Inget datum
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Action buttons */}
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
