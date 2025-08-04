import { FileText } from 'lucide-react'

import { Badge } from '../ui/v2/Badge'

interface Props {
  primaryContractNumber: string
  secondaryContractNumber?: string
  isSecondaryRental: boolean
}

export function LeaseInfo({
  primaryContractNumber,
  secondaryContractNumber,
  isSecondaryRental,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <FileText className="h-5 w-5 mr-2 text-slate-500" />
          <h3 className="text-lg font-medium">Kontraktsinformation</h3>
        </div>
        {isSecondaryRental && (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            Andrahandsuthyrning
          </Badge>
        )}
      </div>

      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Kontraktsnummer</p>
            <p className="font-medium">{primaryContractNumber}</p>
          </div>
          {isSecondaryRental && secondaryContractNumber && (
            <div>
              <p className="text-sm text-muted-foreground">
                Andrahandskontraktsnummer
              </p>
              <p className="font-medium">{secondaryContractNumber}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
