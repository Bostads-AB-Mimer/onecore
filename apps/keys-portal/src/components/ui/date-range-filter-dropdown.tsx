'use client'

import * as React from 'react'
import { CalendarIcon, Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function formatDate(date: Date | undefined) {
  if (!date) {
    return ''
  }

  return date.toLocaleDateString('sv-SE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false
  }
  return !isNaN(date.getTime())
}

interface DateRangeFilterDropdownProps {
  afterDate: string | null
  beforeDate: string | null
  onDatesChange: (afterDate: string | null, beforeDate: string | null) => void
  className?: string
}

export function DateRangeFilterDropdown({
  afterDate,
  beforeDate,
  onDatesChange,
  className,
}: DateRangeFilterDropdownProps) {
  const hasActiveFilter = afterDate !== null || beforeDate !== null

  // After date state
  const [openAfter, setOpenAfter] = React.useState(false)
  const [dateAfter, setDateAfter] = React.useState<Date | undefined>(
    afterDate ? new Date(afterDate) : undefined
  )
  const [monthAfter, setMonthAfter] = React.useState<Date | undefined>(
    dateAfter
  )
  const [valueAfter, setValueAfter] = React.useState(formatDate(dateAfter))

  // Before date state
  const [openBefore, setOpenBefore] = React.useState(false)
  const [dateBefore, setDateBefore] = React.useState<Date | undefined>(
    beforeDate ? new Date(beforeDate) : undefined
  )
  const [monthBefore, setMonthBefore] = React.useState<Date | undefined>(
    dateBefore
  )
  const [valueBefore, setValueBefore] = React.useState(formatDate(dateBefore))

  const handleApply = () => {
    const afterValue = dateAfter ? dateAfter.toISOString().split('T')[0] : null
    const beforeValue = dateBefore
      ? dateBefore.toISOString().split('T')[0]
      : null
    onDatesChange(afterValue, beforeValue)
  }

  const handleClearAll = () => {
    setDateAfter(undefined)
    setValueAfter('')
    setDateBefore(undefined)
    setValueBefore('')
    onDatesChange(null, null)
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
            <Label htmlFor="date-after" className="text-sm font-medium">
              Efter (från och med)
            </Label>
            <div className="relative flex gap-2">
              <Input
                id="date-after"
                value={valueAfter}
                placeholder="Välj datum"
                className="bg-background pr-10"
                onChange={(e) => {
                  const date = new Date(e.target.value)
                  setValueAfter(e.target.value)
                  if (isValidDate(date)) {
                    date.setHours(12, 0, 0, 0)
                    setDateAfter(date)
                    setMonthAfter(date)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setOpenAfter(true)
                  }
                }}
              />
              <Popover open={openAfter} onOpenChange={setOpenAfter}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                  >
                    <CalendarIcon className="size-3.5" />
                    <span className="sr-only">Select date</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto overflow-hidden p-0"
                  align="end"
                  alignOffset={-8}
                  sideOffset={10}
                >
                  <Calendar
                    mode="single"
                    selected={dateAfter}
                    captionLayout="dropdown"
                    month={monthAfter}
                    onMonthChange={setMonthAfter}
                    onSelect={(date) => {
                      // Set time to noon to avoid timezone conversion issues
                      if (date) {
                        date.setHours(12, 0, 0, 0)
                      }
                      setDateAfter(date)
                      setValueAfter(formatDate(date))
                      setOpenAfter(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="date-before" className="text-sm font-medium">
              Före (till och med)
            </Label>
            <div className="relative flex gap-2">
              <Input
                id="date-before"
                value={valueBefore}
                placeholder="Välj datum"
                className="bg-background pr-10"
                onChange={(e) => {
                  const date = new Date(e.target.value)
                  setValueBefore(e.target.value)
                  if (isValidDate(date)) {
                    date.setHours(12, 0, 0, 0)
                    setDateBefore(date)
                    setMonthBefore(date)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setOpenBefore(true)
                  }
                }}
              />
              <Popover open={openBefore} onOpenChange={setOpenBefore}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                  >
                    <CalendarIcon className="size-3.5" />
                    <span className="sr-only">Select date</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto overflow-hidden p-0"
                  align="end"
                  alignOffset={-8}
                  sideOffset={10}
                >
                  <Calendar
                    mode="single"
                    selected={dateBefore}
                    captionLayout="dropdown"
                    month={monthBefore}
                    onMonthChange={setMonthBefore}
                    onSelect={(date) => {
                      // Set time to noon to avoid timezone conversion issues
                      if (date) {
                        date.setHours(12, 0, 0, 0)
                      }
                      setDateBefore(date)
                      setValueBefore(formatDate(date))
                      setOpenBefore(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
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
