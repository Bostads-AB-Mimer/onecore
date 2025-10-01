import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter, Calendar } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

interface MoveManagementToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  dateFrom: Date
  dateTo: Date
  onDateFromChange: (date: Date | undefined) => void
  onDateToChange: (date: Date | undefined) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
}

export function MoveManagementToolbar({
  searchQuery,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  statusFilter,
  onStatusFilterChange,
}: MoveManagementToolbarProps) {
  return (
    <div className="flex items-center gap-4 mb-6 flex-wrap">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Sök hyresgäster..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[240px] justify-start">
            <Calendar className="mr-2 h-4 w-4" />
            {dateFrom && format(dateFrom, 'PP', { locale: sv })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={dateFrom}
            onSelect={onDateFromChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground">till</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[240px] justify-start">
            <Calendar className="mr-2 h-4 w-4" />
            {dateTo && format(dateTo, 'PP', { locale: sv })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={dateTo}
            onSelect={onDateToChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>

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
  )
}
