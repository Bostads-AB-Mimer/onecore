import { Calendar } from 'lucide-react'

interface TenantPersonalInfoProps {
  firstName: string
  lastName: string
  fullName?: string
  moveInDate: string
  lastDebitDate?: string
  preferredMoveOutDate?: string
  personalNumber: string
  contactCode: string
}

export function TenantPersonalInfo({
  firstName,
  lastName,
  fullName,
  moveInDate,
  lastDebitDate,
  preferredMoveOutDate,
  personalNumber,
  contactCode,
}: TenantPersonalInfoProps) {
  const isOrganization = contactCode.startsWith('F')
  const displayName =
    firstName && lastName ? `${firstName} ${lastName}` : fullName || '-'

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Namn</p>
        <p className="font-medium">{displayName}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Inflyttningsdatum</p>
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {new Date(moveInDate).toLocaleDateString('sv-SE')}
          </p>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      {lastDebitDate && (
        <div>
          <p className="text-sm text-muted-foreground">Utflyttningsdatum</p>
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {new Date(lastDebitDate).toLocaleDateString('sv-SE')}
            </p>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
      {preferredMoveOutDate && (
        <div>
          <p className="text-sm text-muted-foreground">
            Önskat avflyttningsdatum
          </p>
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {new Date(preferredMoveOutDate).toLocaleDateString('sv-SE')}
            </p>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
      <div>
        <p className="text-sm text-muted-foreground">
          {isOrganization ? 'Organisationsnummer' : 'Personnummer'}
        </p>
        <p className="font-medium">{personalNumber}</p>
      </div>
    </div>
  )
}
