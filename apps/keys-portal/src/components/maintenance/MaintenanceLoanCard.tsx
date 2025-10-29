import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, Calendar, User, FileText } from 'lucide-react'
import type { KeyLoanMaintenanceKeysWithDetails } from '@/services/types'
import { MaintenanceKeysTable } from './MaintenanceKeysTable'

type Props = {
  loan: KeyLoanMaintenanceKeysWithDetails
}

export function MaintenanceLoanCard({ loan }: Props) {
  const isReturned = !!loan.returnedAt

  return (
    <Card className="overflow-hidden">
      {/* Loan Header - Acts as "table header" */}
      <div
        className={`px-4 py-3 border-b ${
          isReturned ? 'bg-muted/50' : 'bg-primary/5'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            {/* Contact Person */}
            {loan.contactPerson && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{loan.contactPerson}</span>
              </div>
            )}

            {/* Description */}
            {loan.description && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{loan.description}</span>
              </div>
            )}
          </div>

          {/* Status Badge and Dates */}
          <div className="flex flex-col items-end gap-2">
            <Badge variant={isReturned ? 'secondary' : 'default'}>
              {isReturned ? 'Återlämnad' : 'Aktiv'}
            </Badge>

            {loan.returnedAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(new Date(loan.returnedAt), 'PPP', { locale: sv })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keys Table - Acts as "table body" */}
      <CardContent className="p-0">
        <MaintenanceKeysTable keys={loan.keysArray} />
      </CardContent>
    </Card>
  )
}
