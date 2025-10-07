import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search } from 'lucide-react'

interface KeySystemsToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onAddNew: () => void
}

export function KeySystemsToolbar({
  searchQuery,
  onSearchChange,
  onAddNew,
}: KeySystemsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Sök låssystem..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <Button onClick={onAddNew} className="bg-primary hover:bg-primary/90">
        <Plus className="h-4 w-4 mr-2" />
        Nytt låssystem
      </Button>
    </div>
  )
}
