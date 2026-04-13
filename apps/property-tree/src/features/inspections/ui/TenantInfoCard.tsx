import { useNavigate } from 'react-router-dom'
import { ExternalLink, MapPin, User } from 'lucide-react'

import { paths } from '@/shared/routes'
import { Avatar, AvatarFallback } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

/**
 * Minimal view-model for the tenant card. Kept separate from the full
 * `Tenant` type so callers can render the card from different data sources
 * (e.g. a lightweight `TenantContactsResponse` entry or a fully-hydrated
 * `Tenant` with its housing contract).
 */
export interface TenantInfoCardData {
  contactCode: string
  fullName: string
  moveInDate?: string | null
  moveOutDate?: string | null
  isAboutToLeave?: boolean
}

interface TenantInfoCardProps {
  tenant: TenantInfoCardData
  address?: string
  apartmentCode?: string | null
}

const formatDate = (value?: string | null): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('sv-SE')
}

export function TenantInfoCard({
  tenant,
  address,
  apartmentCode,
}: TenantInfoCardProps) {
  const navigate = useNavigate()

  const handleOpenTenantProfile = () => {
    if (tenant.contactCode) {
      navigate(paths.tenant(tenant.contactCode))
    }
  }

  const locationLabel = [address, apartmentCode && `lägenhet ${apartmentCode}`]
    .filter(Boolean)
    .join(', ')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Hyresgäst</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenTenantProfile}
            className="h-8 px-2"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-base">{tenant.fullName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Inflyttningsdatum</p>
            <p className="font-medium">{formatDate(tenant.moveInDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Utflyttningsdatum</p>
            <p className="font-medium">{formatDate(tenant.moveOutDate)}</p>
          </div>
        </div>

        {(locationLabel || tenant.isAboutToLeave) && (
          <div className="flex items-center justify-between">
            {locationLabel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{locationLabel}</span>
              </div>
            )}
            {tenant.isAboutToLeave && (
              <Badge
                variant="outline"
                className="bg-orange-50 text-orange-700 border-orange-200"
              >
                Uppsagt
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
