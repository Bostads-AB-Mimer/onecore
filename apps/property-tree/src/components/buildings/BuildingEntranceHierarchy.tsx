import { Residence, Staircase } from '@/services/types'
import { Button } from '@/components/ui/v2/Button'
import { Badge } from '@/components/ui/v2/Badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQueries, UseQueryResult } from '@tanstack/react-query'
import { ResidenceSummary } from '@/services/types'

interface BuildingEntranceHierarchyProps {
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
  staircases: Staircase[]
  basePath: string
}

// Helper function to get status badge color
const getStatusBadge = (status?: string) => {
  if (!status) return null

  const variant =
    status === 'Aktiv'
      ? 'default'
      : status === 'Under underhåll'
        ? 'secondary'
        : 'destructive'

  return (
    <Badge variant={variant} className="text-xs">
      {status}
    </Badge>
  )
}

// Helper function to get apartment type styling
/*
const getApartmentTypeStyle = (type?: ApartmentType) => {
  switch (type) {
    case 'Övernattning':
      return 'border-l-4 border-blue-500 bg-blue-50'
    case 'Korttidsboende':
      return 'border-l-4 border-yellow-500 bg-yellow-50'
    default:
      return ''
  }
}
*/

export const BuildingEntranceHierarchy = ({
  residenceStaircaseLookupMap,
  staircases,
  basePath,
}: BuildingEntranceHierarchyProps) => {
  // Return early if no entrances
  if (!staircases || staircases.length === 0) {
    return (
      <div className="text-center py-10">
        <h3 className="text-xl font-medium mb-2">Inga uppgångar</h3>
        <p className="text-muted-foreground">
          Det finns inga uppgångar registrerade för denna byggnad.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="space-y-2">
        {staircases.map((staircase: Staircase) => {
          const isLoading =
            residenceStaircaseLookupMap[staircase.code]?.isLoading
          const error = residenceStaircaseLookupMap[staircase.code]?.error
          const residences =
            residenceStaircaseLookupMap[staircase.code]?.data || []

          const hasResidences = residences.length > 0

          return (
            <AccordionItem
              key={staircase.id}
              value={staircase.id}
              className="rounded-lg border border-slate-200 bg-white"
            >
              <AccordionTrigger className="px-3 sm:px-4 py-3 hover:bg-accent/50">
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{staircase.name}</span>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="px-3 sm:px-4 pb-4 pt-1 space-y-4">
                  <div className="p-2">
                    <div className="space-y-2">
                      {isLoading ? (
                        <div className="text-sm text-muted-foreground">
                          Laddar lägenheter...
                        </div>
                      ) : error || !hasResidences ? (
                        <div className="text-sm text-red-600">
                          Kunde inte ladda lägenheter.
                        </div>
                      ) : (
                        <>
                          {residences.map((residence) => (
                            <div
                              key={residence.id}
                              className={`flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors}`}
                            >
                              <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-foreground">
                                  {residence.rentalId}
                                </span>
                                {/*
                            {residence.apartmentType && residence.apartmentType !== "Standard" && (
                              <Badge variant="outline" className="text-xs">
                                {residence.apartmentType}
                              </Badge>
                              */}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {residence.quantityValues[0].value ?? '-'} m²
                                  • {residence.residenceType.roomCount} rum
                                </span>
                                <Link to={`${basePath}/${residence.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-muted"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
