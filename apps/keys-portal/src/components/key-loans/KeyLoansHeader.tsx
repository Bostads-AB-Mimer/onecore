import { Badge } from '@/components/ui/badge'

interface KeyLoansHeaderProps {
  totalLoans: number
  currentPageCount: number
  activeLoans: number
  returnedLoans: number
}

export function KeyLoansHeader({
  totalLoans,
  currentPageCount,
  activeLoans,
  returnedLoans,
}: KeyLoansHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nyckellån</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {currentPageCount} av {totalLoans} lån
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="default" className="text-xs">
          {activeLoans} aktiva
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {returnedLoans} återlämnade
        </Badge>
      </div>
    </div>
  )
}
