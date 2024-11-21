import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DoorClosed, Home, Users, Building, ArrowRight } from 'lucide-react'
import { propertyService } from '../../services/propertyService'
import { Entrance } from '../../services/types'
import { StatCard } from '../shared/StatCard'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '../ui/Card'
import { Grid } from '../ui/Grid'

export function EntranceView() {
  const { entranceId } = useParams()
  const navigate = useNavigate()
  const [entrance, setEntrance] = React.useState<Entrance | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadEntrance = async () => {
      try {
        const data = await propertyService.getEntrance(entranceId!)
        setEntrance(data)
      } finally {
        setLoading(false)
      }
    }
    loadEntrance()
  }, [entranceId])

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

  if (!entrance) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Uppgång hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={entrance.name}
        subtitle={`Byggnad ${entrance.buildingId}`}
        type="Uppgång"
        icon={DoorClosed}
      />

      <Grid cols={3} className="mb-8">
        <StatCard
          title="Lägenheter"
          value={entrance.totalApartments}
          icon={Home}
          subtitle={`${entrance.occupiedApartments} uthyrda`}
        />
        <StatCard
          title="Uthyrningsgrad"
          value={`${Math.round((entrance.occupiedApartments / entrance.totalApartments) * 100)}%`}
          icon={Users}
        />
        <StatCard
          title="Våningar"
          value={Math.ceil(entrance.totalApartments / 2)}
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
          <Card title="Lägenheter" icon={Home}>
            <Grid cols={2}>
              {entrance.apartments.map((apartmentId) => (
                <motion.div
                  key={apartmentId}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/apartments/${apartmentId}`)}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                        Lägenhet {apartmentId}
                      </h3>
                      <p className="text-sm text-gray-500">
                        3 rum och kök, 75m²
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </Grid>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status" icon={DoorClosed}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Portkod</span>
                  <span className="text-sm font-medium">1234#</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Städning</span>
                  <span className="text-sm font-medium text-green-500">
                    Utförd
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    Senaste inspektion
                  </span>
                  <span className="text-sm font-medium">2024-02-15</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nästa städning</span>
                  <span className="text-sm font-medium">2024-03-01</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    Nästa inspektion
                  </span>
                  <span className="text-sm font-medium">2024-08-15</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
