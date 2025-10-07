import { motion } from 'framer-motion'
import { ArrowRight, LucideIcon } from 'lucide-react'
import { Building } from '@/services/types'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card } from '@/components/ui/Card'

interface BuildingListProps {
  buildings: Building[]
  title?: string
  icon?: LucideIcon
}

export function BuildingList({
  buildings,
  title = 'Byggnader',
  icon,
}: BuildingListProps) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const companyId = state?.companyId

  return (
    <Card title={title}>
      <div className="space-y-4">
        {buildings.map((building) => (
          <motion.div
            key={building.id}
            whileHover={{ scale: 1.02 }}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
            onClick={() =>
              navigate(`/buildings/${building.id}`, { state: { companyId } })
            }
          >
            <div>
              <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                {building.name}
              </h3>
              <p className="text-sm text-gray-500">
                {building.buildingType.name}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </motion.div>
        ))}
      </div>
    </Card>
  )
}
