import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, ChefHat, GitGraph, CalendarClock } from 'lucide-react'
import { ResidenceRooms } from '../shared/ResidenceRooms'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Grid'
import { StatCard } from '../shared/StatCard'
import { ContractModal } from '../shared/ContractModal'
import { residenceService } from '@/services/api'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-in">
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      <Grid cols={4} className="mb-8">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
          />
        ))}
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

export function ResidenceView() {
  const { residenceId } = useParams()
  const { state } = useLocation()
  const [showContract, setShowContract] = React.useState(false)

  const residenceQuery = useQuery({
    queryKey: ['residence', residenceId],
    queryFn: () => residenceService.getById(residenceId!),
    enabled: !!residenceId,
  })

  const buildingCode = state?.buildingCode
  const floorCode = state?.floorCode

  const isLoading = residenceQuery.isLoading
  const error = residenceQuery.error
  const residence = residenceQuery.data

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !residence) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Bostad hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={`${residence.residenceType?.name}, ${residence.code}`}
        subtitle={residence.name}
        type="Bostad"
        icon={Home}
      />

      <Grid cols={4} className="mb-8">
        <StatCard
          title="Rum"
          value={residence.residenceType?.roomCount}
          icon={Home}
          subtitle="Antal rum"
        />
        <StatCard
          title="Kök"
          value={residence.residenceType?.kitchen}
          icon={ChefHat}
        />
        <StatCard title="Uppgång" value={residence.entrance} icon={GitGraph} />
        <StatCard
          title="Giltighet"
          value={new Date(
            residence.validityPeriod?.fromDate
          ).toLocaleDateString()}
          icon={CalendarClock}
          subtitle={`Till ${new Date(residence.validityPeriod?.toDate).toLocaleDateString()}`}
        />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <ResidenceRooms
            buildingCode={buildingCode}
            floorCode={floorCode}
            residenceId={residenceId}
          />

          <Card title="Egenskaper">
            <Grid cols={2}>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="font-medium mb-2">Tillgänglighet</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Rullstolsanpassad
                    </span>
                    <Badge
                      variant={
                        residence.accessibility?.wheelchairAccessible
                          ? 'success'
                          : 'default'
                      }
                    >
                      {residence.accessibility?.wheelchairAccessible
                        ? 'Ja'
                        : 'Nej'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Bostadsanpassad
                    </span>
                    <Badge
                      variant={
                        residence.accessibility?.residenceAdapted
                          ? 'success'
                          : 'default'
                      }
                    >
                      {residence.accessibility?.residenceAdapted ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Hiss</span>
                    <Badge
                      variant={
                        residence.accessibility?.elevator
                          ? 'success'
                          : 'default'
                      }
                    >
                      {residence.accessibility?.elevator ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="font-medium mb-2">Faciliteter</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Extra toalett</span>
                    <Badge
                      variant={
                        residence.features?.extraToilet ? 'success' : 'default'
                      }
                    >
                      {residence.features?.extraToilet ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Bastu</span>
                    <Badge
                      variant={
                        residence.features?.sauna ? 'success' : 'default'
                      }
                    >
                      {residence.features?.sauna ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Delat kök</span>
                    <Badge
                      variant={
                        residence.features?.sharedKitchen
                          ? 'success'
                          : 'default'
                      }
                    >
                      {residence.features?.sharedKitchen ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Grid>
          </Card>

          <Card title="Särskilda egenskaper">
            <Grid cols={2}>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="font-medium mb-2">Miljö</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Rökfri</span>
                    <Badge
                      variant={
                        residence.features?.smokeFree ? 'success' : 'default'
                      }
                    >
                      {residence.features?.smokeFree ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Asbest</span>
                    <Badge
                      variant={
                        residence.features?.asbestos ? 'warning' : 'success'
                      }
                    >
                      {residence.features?.asbestos ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="font-medium mb-2">Allergianpassning</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Pälsdjursfri</span>
                    <Badge
                      variant={
                        residence.features?.petAllergyFree
                          ? 'success'
                          : 'default'
                      }
                    >
                      {residence.features?.petAllergyFree ? 'Ja' : 'Nej'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Elanpassad</span>
                    <Badge
                      variant={
                        residence.features?.electricAllergyIntolerance
                          ? 'success'
                          : 'default'
                      }
                    >
                      {residence.features?.electricAllergyIntolerance
                        ? 'Ja'
                        : 'Nej'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Grid>
          </Card>

          <ResidenceRooms
            residenceId={residence.id}
            buildingCode={buildingCode}
            floorCode={floorCode}
          />
        </div>

        <div className="space-y-6">
          <Card title="Teknisk information">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Energiklass</span>
                  <span className="text-sm font-medium">
                    {residence.propertyObject?.energy.energyClass ||
                      'Ej angiven'}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Lägenhetsnummer</span>
                  <span className="text-sm font-medium">{residence.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Typ</span>
                  <span className="text-sm font-medium">
                    {residence.residenceType?.code.trim()}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {/*residence.tenant && (
        <ContractModal
          isOpen={showContract}
          onClose={() => setShowContract(false)}
          tenant={residence.tenant}
          residence={residence}
        />
      )*/}
    </div>
  )
}
