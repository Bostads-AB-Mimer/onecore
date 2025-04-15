import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building, DoorClosed, Home, Users, ArrowRight } from 'lucide-react'
import {
  buildingService,
  residenceService,
  staircaseService,
  propertyService,
} from '../../services/api'
import { StatCard } from '../shared/StatCard'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Grid'

export function BuildingView() {
  const { buildingId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const propertyId = state?.propertyId

  const buildingQuery = useQuery({
    queryKey: ['building', buildingId],
    queryFn: () => buildingService.getById(buildingId!),
    enabled: !!buildingId,
  })

  const propertyQuery = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getPropertyById(propertyId),
    enabled: !!propertyId,
  })

  const residencesQuery = useQuery({
    queryKey: ['residences', buildingQuery.data?.code],
    queryFn: () => residenceService.getByBuildingCode(buildingQuery.data!.code),
    enabled: !!buildingQuery.data?.code,
  })

  const staircasesQuery = useQuery({
    queryKey: ['staircases', buildingQuery.data?.code],
    queryFn: () => staircaseService.getByBuildingCode(buildingQuery.data!.code),
    enabled: !!buildingQuery.data?.code,
  })

  const isLoading =
    buildingQuery.isLoading ||
    residencesQuery.isLoading ||
    staircasesQuery.isLoading ||
    propertyQuery.isLoading
  const error =
    buildingQuery.error ||
    residencesQuery.error ||
    staircasesQuery.error ||
    propertyQuery.error
  const building = buildingQuery.data
  const property = propertyQuery.data

  if (isLoading) {
    return (
      <div className="p-8 animate-in">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

        <Grid cols={3} className="mb-8">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
            />
          ))}
        </Grid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !building) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Byggnad hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={building.name}
        subtitle={`Fastighet ${property?.designation}`}
        type="Byggnad"
        icon={Building}
      />

      <Grid cols={4} className="mb-8">
        <StatCard
          title="Lägenheter"
          value={residencesQuery.data?.length || 0}
          icon={Home}
          subtitle={`${residencesQuery.data?.filter((r) => !r.deleted).length || 0} aktiva`}
        />
        <StatCard
          title="Byggår"
          value={building.construction.constructionYear ?? ''}
          icon={DoorClosed}
        />
        <StatCard
          title="Senast renoverad"
          value={building.construction.renovationYear ?? ''}
          subtitle={
            (building.construction.valueYear && ' (värdeår)') || undefined
          }
          icon={Users}
        />
        <StatCard
          title="Byggnadstyp"
          value={building.buildingType.name}
          icon={Building}
        />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2">
          <div className="space-y-6">
            <Card title="Uppgångar" icon={DoorClosed}>
              <Grid cols={2}>
                {staircasesQuery.data?.map((staircase) => (
                  <motion.div
                    key={staircase.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() =>
                      navigate(`/staircases/${building.id}/${staircase.id}`)
                    }
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                          {`Uppgång ${staircase.code}`}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {residencesQuery.data?.filter((r) =>
                            r.code.startsWith(staircase.code.trim())
                          ).length || 0}{' '}
                          lägenheter
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </Grid>
            </Card>

            <Card title="Lägenheter" icon={Home}>
              <Grid cols={2}>
                {residencesQuery.data?.map((residence) => (
                  <motion.div
                    key={residence.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() =>
                      navigate(`/residences/${residence.id}`, {
                        state: {
                          buildingCode: building.code,
                          staircaseCode: residence.code.substring(2, 4),
                          propertyId: propertyQuery.data?.id,
                        },
                      })
                    }
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                          {residence.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Uppgång {residence.code.substring(0, 2)}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </Grid>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card title="Status" icon={Building}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg opacity-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">
                    Underhållsstatus
                  </span>
                  <span className="text-sm font-medium text-green-500">
                    God
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: '85%' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center opacity-50">
                  <span className="text-sm text-gray-500">
                    Senaste besiktning
                  </span>
                  <span className="text-sm font-medium">2024-01-15</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    Nästa besiktning
                  </span>
                  <span className="text-sm font-medium">2024-07-15</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
