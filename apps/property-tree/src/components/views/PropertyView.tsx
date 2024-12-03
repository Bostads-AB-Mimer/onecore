import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2,
  Calendar,
  Home,
  Wrench,
  Users,
  ArrowRight,
} from 'lucide-react'
import { propertyService } from '../../services/api'
import { Property } from '../../services/types'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '../ui/Card'
import { Grid } from '../ui/Grid'
import { StatCard } from '../shared/StatCard'

export function PropertyView() {
  const { propertyId } = useParams()
  const navigate = useNavigate()
  const [property, setProperty] = React.useState<Property | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadProperty = async () => {
      try {
        const data = await propertyService.getProperty(propertyId!)
        setProperty(data)
      } finally {
        setLoading(false)
      }
    }
    loadProperty()
  }, [propertyId])

  if (loading) {
    return (
      <div className="p-8 animate-in">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

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
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Fastighet hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={property.name}
        subtitle={property.address}
        type="Fastighet"
        icon={Building2}
      />

      <Grid cols={4} className="mb-8">
        <StatCard
          title="Lägenheter"
          value={property.totalApartments}
          icon={Home}
          subtitle={`${property.occupiedApartments} uthyrda`}
        />
        <StatCard
          title="Byggnader"
          value={property.buildings.length}
          icon={Building2}
        />
        <StatCard
          title="Byggår"
          value={property.constructionYear}
          icon={Calendar}
        />
        {property.lastRenovation && (
          <StatCard
            title="Senaste renovering"
            value={property.lastRenovation}
            icon={Wrench}
          />
        )}
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <Card title="Byggnader" icon={Building2}>
            <Grid cols={2}>
              {property.buildings.map((buildingId) => (
                <motion.div
                  key={buildingId}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/buildings/${buildingId}`)}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                        Byggnad {buildingId}
                      </h3>
                      <p className="text-sm text-gray-500">4 uppgångar</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </Grid>
          </Card>

          <Card title="Historik" icon={Calendar}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Inga tidigare ärenden registrerade
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Hyresgäster" icon={Users}>
            <div className="space-y-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
                onClick={() => navigate('/tenants/tenant-1')}
              >
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-medium shadow-lg shadow-blue-500/20">
                    AS
                  </div>
                  <div>
                    <p className="font-medium group-hover:text-blue-500 transition-colors">
                      Anna Svensson
                    </p>
                    <p className="text-sm text-gray-500">Lägenhet 101</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </motion.div>
            </div>
          </Card>

          <Card title="Status" icon={Building2}>
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
