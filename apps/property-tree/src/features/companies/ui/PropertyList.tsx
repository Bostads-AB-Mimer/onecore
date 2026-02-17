import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, Home } from 'lucide-react'

import { Property } from '@/services/types'

import { paths } from '@/shared/routes'
import { Card } from '@/shared/ui/Card'
import { Grid } from '@/shared/ui/Grid'

interface PropertyListProps {
  properties: Property[]
  companyId?: string
}

export function PropertyList({ properties, companyId }: PropertyListProps) {
  const navigate = useNavigate()

  return (
    <Card title="Fastigheter">
      <Grid cols={2} className="p-4">
        {properties?.map((property) => (
          <motion.div
            key={property.code}
            whileHover={{ scale: 1.02 }}
            className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
            onClick={() =>
              navigate(paths.property(property.code), { state: { companyId } })
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium group-hover:text-blue-500 transition-colors">
                  {property.designation}
                </h3>
                <p className="text-sm text-gray-500">{property.municipality}</p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <Home className="h-4 w-4 mr-1" />
                  <span>{property.tract}</span>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </motion.div>
        ))}
      </Grid>
    </Card>
  )
}
