import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter } from 'lucide-react'

interface MoveManagementToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  moveOutMonth: number
  moveOutYear: number
  moveInMonth: number
  moveInYear: number
  onMoveOutMonthChange: (month: number) => void
  onMoveOutYearChange: (year: number) => void
  onMoveInMonthChange: (month: number) => void
  onMoveInYearChange: (year: number) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
}

export function MoveManagementToolbar({
  searchQuery,
  onSearchChange,
  moveOutMonth,
  moveOutYear,
  moveInMonth,
  moveInYear,
  onMoveOutMonthChange,
  onMoveOutYearChange,
  onMoveInMonthChange,
  onMoveInYearChange,
  statusFilter,
  onStatusFilterChange,
}: MoveManagementToolbarProps) {
  const months = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Sök hyresgäster..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="completed">Slutförda</SelectItem>
            <SelectItem value="pending">Väntande</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Utflyttningar:</span>
          <Select value={moveOutMonth.toString()} onValueChange={(v) => onMoveOutMonthChange(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={moveOutYear.toString()} onValueChange={(v) => onMoveOutYearChange(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Inflyttningar:</span>
          <Select value={moveInMonth.toString()} onValueChange={(v) => onMoveInMonthChange(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={moveInYear.toString()} onValueChange={(v) => onMoveInYearChange(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
