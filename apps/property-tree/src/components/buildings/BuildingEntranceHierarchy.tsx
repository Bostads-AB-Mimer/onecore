import { Staircase, Residence } from '@/services/types'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/v2/Button'
import { Badge } from '@/components/ui/v2/Badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import {
  ChevronRight,
  Home,
  Monitor,
  Mail,
  Package,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { residenceService } from '@/services/api/core'
import { useMemo } from 'react'

interface BuildingEntranceHierarchyProps {
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

export const BuildingEntranceHierarchy = ({
  staircases,
  basePath,
}: BuildingEntranceHierarchyProps) => {
  console.log('Staircases in Hierarchy', staircases)

  const residenceQueriesArray = useQueries({
    queries: staircases.map((staircase) => {
      return {
        queryKey: [
          'staircase-residence',
          staircase.buildingCode,
          staircase.code,
        ],
        queryFn: () =>
          residenceService.getByBuildingCodeAndStaircaseCode(
            staircase.buildingCode,
            staircase.code
          ),
        enabled: !!staircase.code,
      }
    }),
  })

  const residenceQueries = useMemo(
    () =>
      staircases.reduce(
        (acc, staircase, index) => {
          acc[staircase.code] = residenceQueriesArray[index]
          return acc
        },
        {} as Record<string, (typeof residenceQueriesArray)[number]>
      ),
    [residenceQueriesArray, staircases]
  )

  console.log('Residence Queries:', residenceQueries)

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
          const isLoading = residenceQueries[staircase.code]?.isLoading
          const error = residenceQueries[staircase.code]?.error
          const residences = residenceQueries[staircase.code]?.data || []

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
                                  {residence.code}
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
                                  {'x'}m² • {'x'} rum
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

                {/* Components */}
                {/*
                {entrance.components && entrance.components.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-semibold text-foreground">
                      Komponenter
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {entrance.components.map((component) => (
                        <ComponentCard
                          key={component.id}
                          title={component.name}
                          description={component.description}
                          type={component.type}
                          location={entrance.name}
                          specs={[
                            {
                              label: 'Status',
                              value: component.status || 'Aktiv',
                            },
                          ]}
                        />
                      ))}
                    </div>
                  </div>
                )}
                */}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
