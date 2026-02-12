import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2 } from 'lucide-react'
import { PropertyMap } from '../features/companies/ui/PropertyMap'
import { PropertyList } from '../features/companies/ui/PropertyList'
import { companyService, propertyService } from '../services/api/core'
import { Card } from '@/shared/ui/Card'
import { Grid } from '@/shared/ui/Grid'
import { StatCard } from '../shared/ui/StatCard'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
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

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={company}
        notFoundMessage="Företaget kunde inte hittas"
        searchedFor={companyId}
      >
        {(company) => (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
            </div>

            <Grid cols={4} className="mb-8">
              <StatCard
                title="Fastigheter"
                value={propertiesQuery.data?.length || '0'}
                icon={Building2}
              />
            </Grid>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2">
                <PropertyList
                  properties={propertiesQuery.data || []}
                  companyId={companyId}
                />
              </div>

              <div className="space-y-6">
                <Card title="Karta">
                  <PropertyMap
                    properties={propertiesQuery.data || []}
                    companyName={company.name}
                  />
                </Card>
              </div>
            </motion.div>
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
