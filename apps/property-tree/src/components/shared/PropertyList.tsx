import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, Home } from 'lucide-react'
import { Property } from '@/services/types'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Grid'

interface PropertyListProps {
  properties: Property[]
}

export function PropertyList({ properties }: PropertyListProps) {
  const navigate = useNavigate()

  return (
    <Card title="Fastigheter" icon={Building2}>
      <Grid cols={2}>
        {properties?.map((property) => (
          <motion.div
            key={property.id}
            whileHover={{ scale: 1.02 }}
            className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer group"
            onClick={() => navigate(`/properties/${property.id}`)}
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
