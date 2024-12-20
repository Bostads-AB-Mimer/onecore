import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building, DoorClosed, Home, Users, ArrowRight } from 'lucide-react'
import { buildingService, propertyService } from '../../services/api'
import { Building as BuildingType } from '../../services/types'
import { StatCard } from '../shared/StatCard'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '../ui/Card'
import { Grid } from '../ui/Grid'

export function BuildingView() {
  const { buildingId } = useParams()
  const navigate = useNavigate()
  const [building, setBuilding] = React.useState<BuildingType | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadBuilding = async () => {
      try {
        const data = await buildingService.getById(buildingId!)
        setBuilding(data)
      } finally {
        setLoading(false)
      }
    }
    loadBuilding()
  }, [buildingId])

  if (loading) {
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

  if (!building) {
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
        subtitle={`Fastighet ${building.propertyId}`}
        type="Byggnad"
        icon={Building}
      />

      <Grid cols={3} className="mb-8">
        <StatCard
          title="Lägenheter"
          value={building.totalApartments}
          icon={Home}
          subtitle={`${building.occupiedApartments} uthyrda`}
        />
        <StatCard
          title="Uppgångar"
          value={building.entrances.length}
          icon={DoorClosed}
        />
        <StatCard
          title="Uthyrningsgrad"
          value={`${Math.round((building.occupiedApartments / building.totalApartments) * 100)}%`}
          icon={Users}
        />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2">
          <Card title="Uppgångar" icon={DoorClosed}>
            <Grid cols={2}>
              {building.entrances.map((entranceId) => (
                <motion.div
                  key={entranceId}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/entrances/${entranceId}`)}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                        Uppgång {entranceId}
                      </h3>
                      <p className="text-sm text-gray-500">6 lägenheter</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </Grid>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status" icon={Building}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
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
                <div className="flex justify-between items-center">
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
