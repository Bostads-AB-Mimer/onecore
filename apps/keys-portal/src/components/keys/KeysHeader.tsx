import { Badge } from '@/components/ui/badge'

interface KeysHeaderProps {
  totalKeys: number
  displayedKeys: number
}

export function KeysHeader({ totalKeys, displayedKeys }: KeysHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nycklar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {displayedKeys} av {totalKeys} nycklar
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="text-xs">
          Mimer Nyckelhantering
        </Badge>
      </div>
    </div>
  )
}
