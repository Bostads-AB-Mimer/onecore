import React from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Users, Home, Wallet, MapPin } from 'lucide-react'
import { PropertyMap } from '../shared/PropertyMap'
import { PropertyList } from '../shared/PropertyList'
import { companyService, propertyService } from '../../services/api'
import { ViewHeader } from '../shared/ViewHeader'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Grid'
import { StatCard } from '../shared/StatCard'
import { useQuery } from '@tanstack/react-query'

export function CompanyView() {
  const { companyId } = useParams()
  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companyService.getById(companyId!),
    enabled: !!companyId,
  })

  const propertiesQuery = useQuery({
    queryKey: ['properties', companyId],
    queryFn: () => propertyService.getFromCompany(companyQuery.data!),
    enabled: !!companyQuery.data,
  })

  const isLoading = companyQuery.isLoading || propertiesQuery.isLoading
  const error = companyQuery.error || propertiesQuery.error
  const company = companyQuery.data

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

  if (error) {
    console.error('Failed to load company:', error)
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Ett fel uppstod när företaget skulle hämtas
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Försök igen senare eller kontakta support om problemet kvarstår
        </p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Företaget kunde inte hittas
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Kontrollera att företags-ID är korrekt
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 animate-in">
      <ViewHeader
        title={company.name}
        subtitle={`${propertiesQuery.data?.length} fastigheter`}
        type="Företag"
        icon={Building2}
      />

      <Grid cols={4} className="mb-8">
        <StatCard
          title="Fastigheter"
          value={propertiesQuery.data?.length || '0'}
          icon={Building2}
        />
        <StatCard
          title="Lägenheter"
          value={'? st'}
          icon={Home}
          subtitle={`? st uthyrda`}
        />
        <StatCard title="Hyresgäster" value={'?'} icon={Users} />
        <StatCard title="Årshyra" value={`? kr`} icon={Wallet} />
      </Grid>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2">
          <PropertyList properties={propertiesQuery.data || []} />
        </div>

        <div className="space-y-6">
          <Card title="Karta" icon={MapPin}>
            <PropertyMap
              properties={propertiesQuery.data || []}
              companyName={company.name}
            />
          </Card>
          <Card title="Status" icon={Building2}>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg opacity-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Uthyrningsgrad</span>
                  <span className="text-sm font-medium text-green-500">
                    ? %
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `? %`,
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
