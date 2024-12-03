import React from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Building2, Users, Home } from 'lucide-react'
import { propertyService } from '../../services/api'
import { Property } from '../../services/types'

export function AreaView() {
  const { areaId } = useParams()
  const [areaName, setAreaName] = React.useState<string>('')
  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadAreaData = async () => {
      try {
        // Get all areas to find the name
        const areas = await propertyService.getAreas()
        const currentArea = areas.find(area => area === areaId)
        setAreaName(currentArea || areaId || '')

        // Load properties for this area
        const areaProperties = await propertyService.getAll(areaId)
        setProperties(areaProperties)
      } finally {
        setLoading(false)
      }
    }
    loadAreaData()
  }, [areaId])

  if (loading) return <div>Loading...</div>
  if (!areaName) return <div>Area not found</div>

  return (
    <div className="p-8 animate-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-700 to-gray-800 dark:from-white dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent">
          {areaName}
        </h1>
        <div className="flex items-center text-gray-500 mt-2">
          <MapPin className="h-4 w-4 mr-2" />
          <span>Område</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Översikt</h2>
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Fastigheter</span>
              <span className="font-semibold">{properties.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Lägenheter</span>
              <span className="font-semibold">{properties.reduce((sum, p) => sum + (p.totalApartments || 0), 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Uthyrda lägenheter</span>
              <span className="font-semibold">{properties.reduce((sum, p) => sum + (p.occupiedApartments || 0), 0)}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Statistik</h2>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-48 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Statistik kommer snart</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:col-span-3"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Fastigheter</h2>
            <Home className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => (
              <motion.div
                key={property.id}
                whileHover={{ scale: 1.02 }}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer"
              >
                <h3 className="font-medium">{property.name}</h3>
                <p className="text-sm text-gray-500">{property.address}</p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <Home className="h-4 w-4 mr-1" />
                  <span>{property.totalApartments} lägenheter</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
