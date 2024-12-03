import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Room } from '../../services/types'
import {
  BedDouble,
  ChefHat,
  ShowerHead,
  Sofa,
  Home,
  Maximize2,
  DoorOpen,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { FeatureModal } from './FeatureModal'

const roomIcons = {
  bedroom: BedDouble,
  kitchen: ChefHat,
  bathroom: ShowerHead,
  living: Sofa,
  other: Home,
}

interface RoomCardProps {
  room: Room
  residenceId: string
}

export function RoomCard({ room, residenceId }: RoomCardProps) {
  const navigate = useNavigate()
  const Icon = roomIcons[room.usage.spaceType] || Home
  const [selectedFeature, setSelectedFeature] = React.useState<string | null>(
    null,
  )

  const handleFeatureClick = (e: React.MouseEvent, feature: string) => {
    e.stopPropagation()
    setSelectedFeature(feature)
  }

  const handleClick = () => {
    navigate(`/residences/${residenceId}/rooms/${room.id}`)
  }

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all duration-300 group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Icon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="font-medium group-hover:text-blue-500 transition-colors">
              {room.name}
            </h3>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-gray-500">
              <Maximize2 className="h-4 w-4 mr-2" />
              <span>Typ</span>
            </div>
            <span className="font-medium">{room.name || room.code}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-gray-500">
              <DoorOpen className="h-4 w-4 mr-2" />
              <span>Användning</span>
            </div>
            <span className="font-medium">{room.usage.shared ? 'Delat' : 'Privat'}</span>
          </div>

          {Object.entries(room.features).filter(([_, value]) => value === true).length > 0 && (
            <div className="pt-3 border-t dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                {Object.entries(room.features).map(([feature, value]) => value === true && (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => handleFeatureClick(e, feature)}
                    className="flex items-center space-x-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{feature}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {selectedFeature && (
        <FeatureModal
          isOpen={true}
          onClose={() => setSelectedFeature(null)}
          feature={{
            name: selectedFeature,
            installationDate: '2023-01-01',
            warranty: 't.o.m. 2026-01-01',
            issues: [],
          }}
        />
      )}
    </>
  )
}
