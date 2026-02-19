import { useParams } from 'react-router-dom'
import { Building2 } from 'lucide-react'

import {
  PropertyList,
  PropertyMap,
  useCompanyDetails,
} from '@/features/companies'

import { Card } from '@/shared/ui/Card'
import { Grid } from '@/shared/ui/Grid'
import { ObjectPageLayout, ViewLayout } from '@/shared/ui/layout'
import { StatCard } from '@/shared/ui/StatCard'

export function CompanyPage() {
  const { organizationNumber } = useParams()
  const { company, properties, isLoading, error } =
    useCompanyDetails(organizationNumber)

  return (
    <ViewLayout>
      <ObjectPageLayout
        isLoading={isLoading}
        error={error}
        data={company}
        notFoundMessage="Företaget kunde inte hittas"
        searchedFor={organizationNumber}
      >
        {(company) => (
          <>
            <h1 className="text-3xl font-bold">{company.name}</h1>

            <Grid cols={4}>
              <StatCard
                title="Fastigheter"
                value={properties?.length || '0'}
                icon={Building2}
              />
            </Grid>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <PropertyList
                  properties={properties || []}
                  organizationNumber={organizationNumber}
                />
              </div>

              <div className="space-y-6">
                <Card title="Karta">
                  <PropertyMap
                    properties={properties || []}
                    companyName={company.name}
                  />
                </Card>
              </div>
            </div>
          </>
        )}
      </ObjectPageLayout>
    </ViewLayout>
  )
}
