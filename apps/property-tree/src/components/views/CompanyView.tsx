import React from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Users, Home, Wallet } from 'lucide-react'
import { companyService } from '../../services/api'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '../ui/card'
import { Grid } from '../ui/grid'
import { StatCard } from '../shared/StatCard'
import { CompanyDetails } from '@/services/types'
import { useQuery } from '@tanstack/react-query'

export function CompanyView() {
  const { companyId } = useParams()
  const {
    data: company,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companyService.getById(companyId!),
    enabled: !!companyId,
  })

  if (isLoading) {
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
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Företag hittades inte
        </h2>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={company.name}
        subtitle={`${company.properties?.length} fastigheter`}
        type="Företag"
        icon={Building2}
      />

      <Grid cols={4} className="mb-8">
        <StatCard
          title="Fastigheter"
          value={company.properties?.length}
          icon={Building2}
        />
        <StatCard
          title="Lägenheter"
          value={company.totalApartments}
          icon={Home}
          subtitle={`${company.occupiedApartments} uthyrda`}
        />
        <StatCard
          title="Hyresgäster"
          value={company.occupiedApartments}
          icon={Users}
        />
        <StatCard
          title="Årshyra"
          value={`${company.yearlyRent?.toLocaleString()} kr`}
          icon={Wallet}
        />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2">
          <Card title="Fastigheter" icon={Building2}>
            <Grid cols={2}>
              {company.properties?.map((property) => (
                <motion.div
                  key={property.id}
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <h3 className="font-medium">{property.name}</h3>
                  <p className="text-sm text-gray-500">{property.address}</p>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <Home className="h-4 w-4 mr-1" />
                    <span>{property.totalApartments} lägenheter</span>
                  </div>
                </motion.div>
              ))}
            </Grid>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status" icon={Building2}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Uthyrningsgrad</span>
                  <span className="text-sm font-medium text-green-500">
                    {Math.round(
                      (company.occupiedApartments / company.totalApartments) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${Math.round((company.occupiedApartments / company.totalApartments) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
