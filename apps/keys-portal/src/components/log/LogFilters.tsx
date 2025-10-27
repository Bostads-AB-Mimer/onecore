import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import {
  LogEventTypeLabels,
  LogObjectTypeLabels,
  type LogEventType,
  type LogObjectType,
} from '@/services/types'

type Props = {
  searchQuery: string
  onSearchChange: (v: string) => void
  eventType: LogEventType | 'all'
  onEventTypeChange: (v: LogEventType | 'all') => void
  objectType: LogObjectType | 'all'
  onObjectTypeChange: (v: LogObjectType | 'all') => void
  userName: string
  onUserNameChange: (v: string) => void
  uniqueUsers: string[]
}

export function LogFilters({
  searchQuery,
  onSearchChange,
  eventType,
  onEventTypeChange,
  objectType,
  onObjectTypeChange,
  userName,
  onUserNameChange,
  uniqueUsers,
}: Props) {
  return (
    <Card className="h-fit sticky top-4">
      <CardHeader>
        <CardTitle>Filter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="search">Sök</Label>
          <div className="relative mt-1.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Sök användare, beskrivning, objekt-id… (minst 3 tecken)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="eventType">Händelsetyp</Label>
          <Select
            value={eventType}
            onValueChange={(v) => onEventTypeChange(v as any)}
          >
            <SelectTrigger id="eventType" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla typer</SelectItem>
              {Object.entries(LogEventTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="objectType">Objekttyp</Label>
          <Select
            value={objectType}
            onValueChange={(v) => onObjectTypeChange(v as any)}
          >
            <SelectTrigger id="objectType" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla objekt</SelectItem>
              {Object.entries(LogObjectTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="userName">Användare</Label>
          <Select value={userName} onValueChange={onUserNameChange}>
            <SelectTrigger id="userName" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla användare</SelectItem>
              {uniqueUsers.map((user) => (
                <SelectItem key={user} value={user}>
                  {user}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
