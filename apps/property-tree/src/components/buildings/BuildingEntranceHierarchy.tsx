import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UseQueryResult } from '@tanstack/react-query'
import { ResidenceSummary } from '@/services/types'

interface BuildingEntranceHierarchyProps {
  isLoading: boolean
  residenceStaircaseLookupMap: Record<
    string,
    UseQueryResult<ResidenceSummary[], Error>
  >
  basePath: string
}

export const BuildingEntranceHierarchy = ({
  isLoading,
  residenceStaircaseLookupMap,
  basePath,
}: BuildingEntranceHierarchyProps) => {
  // one query per staircase

  const staircaseQueries = Object.entries(residenceStaircaseLookupMap)

  if (!staircaseQueries || staircaseQueries.length === 0) {
    return (
      <div className="text-center py-10">
        <h3 className="text-xl font-medium mb-2">Inga uppgångar</h3>
        <p className="text-muted-foreground">
          Det finns inga uppgångar registrerade för denna byggnad.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <h3 className="text-xl font-medium mb-2">Laddar uppgångar...</h3>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="space-y-2">
        {Object.entries(residenceStaircaseLookupMap).map(
          ([staircaseCode, queryResult]) => {
            // Get the query result for this staircase
            const isLoading = queryResult.isLoading
            const error = queryResult.error
            const residences = queryResult.data || []

            const hasResidences = residences.length > 0
            const staircaseName = residences?.[0]?.staircaseName

            // Filter out any staircases with no residences
            if (queryResult.data?.length === 0) {
              return null
            }

            return (
              <AccordionItem
                key={staircaseCode}
                value={staircaseCode}
                className="rounded-lg border border-slate-200 bg-white"
              >
                <AccordionTrigger className="px-3 sm:px-4 py-3 hover:bg-accent/50">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{staircaseName}</span>
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
                              <Link
                                key={residence.id}
                                to={`${basePath}/${residence.id}`}
                                className="block"
                              >
                                <div className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-foreground">
                                      {residence.rentalId}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                      {residence.quantityValues?.find(
                                        (x) => x.quantityTypeId === 'BOA'
                                      )?.value || 0}
                                      m² • {residence.residenceType.roomCount}{' '}
                                      rum
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          }
        )}
      </Accordion>
    </div>
  )
}
