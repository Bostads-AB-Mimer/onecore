import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { usePropertyDetails, PropertyBasicInfo } from '@/features/properties'
//import { useToast } from '@/hooks/use-toast'
import { PropertyTabs } from '@/widgets/property-tabs'
import { useIsMobile } from '@/shared/hooks/useMobile'
import { PropertyBreadcrumb } from '@/shared/ui/PropertyBreadcrumb'

const PropertyView = () => {
  const { propertyId } = useParams<{ propertyId: string }>()
  const { state } = useLocation()
  const companyId = state?.companyId

  //const { property } = useParams()
  //const { toast } = useToast()
  const isMobile = useIsMobile()

  // Let the PageLayout handle sidebar state based on route
  useEffect(() => {
    // Default sidebar state is handled in PageLayout based on route
  }, [isMobile])

  // Use property directly as the key
  const propertyKey = propertyId

  const {
    data: propertyDetail,
    isLoading,
    error,
  } = usePropertyDetails(propertyKey)

  useEffect(() => {
    if (error) {
      console.error('Error loading property data:', error)
      /*
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda fastighetsdata. Kontrollera URL:en.',
        variant: 'destructive',
      })
        */
    }
  }, [error /*toast*/])

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-6 py-4">
          <div className="h-8 bg-secondary rounded w-64"></div>
          <div className="h-4 bg-secondary rounded w-32 mt-2"></div>
          <div className="h-[200px] bg-secondary rounded mt-6"></div>
        </div>
      )
    }

    if (error || !propertyDetail) {
      return (
        <div className="text-center py-10 space-y-4">
          <h2 className="text-2xl font-bold">Fastigheten kunde inte hittas</h2>
          <p className="text-muted-foreground">
            Kontrollera adressen och försök igen
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Sökte efter: {propertyKey}
          </p>
        </div>
      )
    }

    return (
      <div className="py-4 space-y-6">
        {/* Hide for now */}
        {/*
        <PropertyBreadcrumb
          property={{
            id: propertyDetail.id,
            name: propertyDetail.designation,
          }}
          companyId={companyId}
        />
        */}
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {propertyDetail.designation}
          </h1>
        </div>

        <PropertyBasicInfo
          propertyDetail={propertyDetail}
          showBasicInfoOnly={true}
        />

        <PropertyTabs propertyDetail={propertyDetail} />
      </div>
    )
  }

  return renderContent()
}

export default PropertyView
