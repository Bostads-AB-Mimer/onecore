import { User, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/v2/Badge'

interface ApplicationProfileDisplayProps {
  profile: {
    numAdults: number
    numChildren: number
    housingType?: string | null
    landlord?: string | null
    housingReference?: {
      phone?: string | null
      email?: string | null
      reviewStatus?: string | null
      comment?: string | null
      reviewedAt?: string | Date | null
      reviewedBy?: string | null
      expiresAt?: string | Date | null
    } | null
  }
}

const housingTypeLabels: Record<string, string> = {
  RENTAL: 'Hyresrätt',
  LODGER: 'Inneboende',
  OWNS_FLAT: 'Äger bostadsrätt',
  OWNS_HOUSE: 'Äger villa/hus',
  LIVES_WITH_FAMILY: 'Bor hos familj/vänner',
  HOMELESS: 'Hemlös',
  OTHER: 'Annat',
  INSTITUTIONAL: 'Institution',
}

const reviewStatusLabels: Record<string, string> = {
  APPROVED: 'Godkänd',
  REJECTED: 'Avvisad',
  PENDING: 'Väntar',
  CONTACTED_UNREACHABLE: 'Ej nåbar',
  REFERENCE_NOT_REQUIRED: 'Referens ej krävs',
}

const getReferenceStatusColor = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-500'
    case 'REJECTED':
      return 'bg-red-500'
    case 'PENDING':
      return 'bg-amber-500'
    case 'CONTACTED_UNREACHABLE':
      return 'bg-orange-500'
    case 'REFERENCE_NOT_REQUIRED':
      return 'bg-blue-500'
    default:
      return 'bg-slate-500'
  }
}

export function ApplicationProfileDisplay({
  profile,
}: ApplicationProfileDisplayProps) {
  const { housingReference } = profile

  return (
    <div className="space-y-4">
      {/* Two-column grid for housing and household info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Nuvarande boendeform
          </p>
          <p className="font-medium">
            {profile.housingType
              ? housingTypeLabels[profile.housingType] || profile.housingType
              : '-'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Hyresvärd</p>
          <p className="font-medium">{profile.landlord || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Vuxna i hushållet</p>
          </div>
          <p className="font-medium">{profile.numAdults ?? 0}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Barn i hushållet</p>
          </div>
          <p className="font-medium">{profile.numChildren ?? 0}</p>
        </div>
      </div>

      {/* Reference status */}
      {housingReference && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Status på boendereferens
            </p>
          </div>
          <Badge
            className={`${getReferenceStatusColor(housingReference.reviewStatus ?? undefined)} text-white mt-1`}
          >
            {reviewStatusLabels[housingReference.reviewStatus || ''] ||
              housingReference.reviewStatus ||
              'Okänd'}
          </Badge>

          {/* Additional reference details - shown below status */}
          {(housingReference.phone ||
            housingReference.email ||
            housingReference.comment) && (
            <div className="mt-3 pt-3 border-t space-y-2 text-sm">
              {housingReference.phone && (
                <div>
                  <span className="text-muted-foreground">Telefon: </span>
                  <span>{housingReference.phone}</span>
                </div>
              )}
              {housingReference.email && (
                <div>
                  <span className="text-muted-foreground">E-post: </span>
                  <span>{housingReference.email}</span>
                </div>
              )}
              {housingReference.comment && (
                <div>
                  <p className="text-muted-foreground mb-1">Kommentar:</p>
                  <p className="text-xs">{housingReference.comment}</p>
                </div>
              )}
              {housingReference.reviewedBy && (
                <div className="text-xs text-muted-foreground">
                  Granskad av: {housingReference.reviewedBy}
                  {housingReference.reviewedAt &&
                    ` (${new Date(housingReference.reviewedAt).toLocaleDateString('sv-SE')})`}
                </div>
              )}
              {housingReference.expiresAt && (
                <div className="text-xs text-muted-foreground">
                  Utgår:{' '}
                  {new Date(housingReference.expiresAt).toLocaleDateString(
                    'sv-SE'
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
