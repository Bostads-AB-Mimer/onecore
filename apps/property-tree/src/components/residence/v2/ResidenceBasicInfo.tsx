import { CollapsibleInfoCard } from '@/components/ui/CollapsibleInfoCard'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { TriangleAlert, Bug } from 'lucide-react'
import { components } from '@/services/api/core/generated/api-types'

interface ResidenceBasicInfoProps {
  residence: components['schemas']['ResidenceDetails']
  building?: components['schemas']['Building']
  lease: components['schemas']['Lease']
}

const getCurrentRent = (lease: components['schemas']['Lease'] | undefined) => {
  // Extract rent from current lease
  const currentRent = lease?.rentInfo?.currentRent?.currentRent
    ? lease.rentInfo.currentRent.currentRent
    : null

  return currentRent
}

const requiresSpecialHandling = (
  residence: components['schemas']['ResidenceDetails']
): boolean => {
  // TODO: Implement logic to determine if special handling is required
  return false
}

const requiresPestControl = (
  residence: components['schemas']['ResidenceDetails']
): boolean => {
  // TODO: Implement logic to determine if pest control is required
  return false
}

export const ResidenceBasicInfo = ({
  residence,
  building,
  lease,
}: ResidenceBasicInfoProps) => {
  // Check if this is a secondary rental based on tenant data
  const needsSpecialHandling = requiresSpecialHandling(residence)
  const hasPestIssues = requiresPestControl(residence)
  const rent = getCurrentRent(lease)

  console.log(JSON.stringify(lease, null, 2))

  return (
    <TooltipProvider>
      <div className="mb-6">
        <div className="flex flex-col gap-2 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{residence.name}</h1>
          {(needsSpecialHandling || hasPestIssues) && (
            <div className="flex items-center gap-2">
              {needsSpecialHandling && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center w-7 h-7 bg-amber-100 rounded-full border border-amber-200 cursor-help">
                      <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Kräver särskild hantering</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {hasPestIssues && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center w-7 h-7 bg-red-100 rounded-full border border-red-200 cursor-help">
                      <Bug className="h-3.5 w-3.5 text-red-600" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Skadedjursproblem rapporterat</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview content for mobile */}
      <CollapsibleInfoCard
        title="Grundläggande information"
        previewContent={
          <div className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">
                Objektsnummer:{' '}
              </span>
              <span className="font-medium">{residence.code}</span>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Adress</p>
            <p className="font-medium">{residence.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Objektsnummer/lägenhetskod
            </p>
            <p className="font-medium">{residence.propertyObject.rentalId}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Skatteverkets lägenhetsnummer
            </p>
            <p className="font-medium">{residence.code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hyresobjektstyp</p>
            <p className="font-medium">
              {residence.propertyObject?.rentalInformation?.type.name}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Typ</p>
            <p className="font-medium">{residence.residenceType.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Yta</p>
            <p className="font-medium">
              {residence.size ? `${residence.size} m²` : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Anläggnings ID Mälarenergi
            </p>
            <p className="font-medium">
              {residence.malarEnergiFacilityId || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hyra</p>
            <p className="font-medium">
              {rent
                ? `${Math.round(rent).toLocaleString('sv-SE')} kr/mån`
                : '-'}
            </p>
          </div>
          {building?.construction.constructionYear && (
            <div>
              <p className="text-sm text-muted-foreground">Byggnadsår</p>
              <p className="font-medium">
                {building.construction.constructionYear}
              </p>
            </div>
          )}
          {building?.construction.renovationYear && (
            <div>
              <p className="text-sm text-muted-foreground">Ombyggnadsår</p>
              <p className="font-medium">
                {building.construction.renovationYear}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium">
              {' '}
              {residence.status === 'LEASED'
                ? 'Uthyrd'
                : residence.status === 'VACANT'
                  ? 'Vakant'
                  : 'N/A'}
            </p>
          </div>
        </div>
      </CollapsibleInfoCard>
    </TooltipProvider>
  )
}
