import { Badge } from '@/components/ui/badge'

interface MoveManagementHeaderProps {
  totalMoveOuts: number
  totalMoveIns: number
}

export function MoveManagementHeader({
  totalMoveOuts,
  totalMoveIns,
}: MoveManagementHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Flytthantering
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalMoveOuts} utflyttningar • {totalMoveIns} inflyttningar
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
