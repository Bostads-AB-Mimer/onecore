import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import type { PropertyDetail } from '@/shared/types/api'
interface PropertyBasicInfoProps {
  propertyDetail: PropertyDetail
  showBasicInfoOnly?: boolean
  showDetailedInfo?: boolean
}
export const PropertyBasicInfo = ({
  propertyDetail,
  showBasicInfoOnly = false,
  showDetailedInfo = false,
}: PropertyBasicInfoProps) => {
  // Basic information card that should always show at the top
  const renderBasicInfoCard = () => (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle>Grundläggande information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Fastighetsbeteckning
            </p>
            <p className="font-medium">{propertyDetail.designation}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Fastighetsnummer</p>
            <p className="font-medium">{propertyDetail.code}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Kommun</p>
            <p className="font-medium">{propertyDetail.municipality}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Distrikt</p>
            <p className="font-medium">
              {propertyDetail?.district?.caption || '-'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Församling</p>
            <p className="font-medium">{propertyDetail.congregation}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Stadsdel/Marknadsområde
            </p>
            <p className="font-medium">
              {propertyDetail?.marketArea?.name || '-'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Fastighetsstatus</p>
            <p className="font-medium">Aktiv</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Antal byggnader</p>
            <p className="font-medium">{propertyDetail.buildings.length}</p>
          </div>

          {/*
            TODO:
            Does a property really have a construction year? What if the buildings have different construction years or renovation years?
            Grabbing it from the first building does not feel right if there are multiple buildings.


          <div>
            <p className="text-sm text-muted-foreground">Byggnadsår</p>
            <p className="font-medium">
              {propertyDetail.buildings.length > 0
                ? propertyDetail.buildings[0].construction.constructionYear
                : '-'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Ombyggnadsår</p>
            <p className="font-medium">
              {propertyDetail.buildings.length > 0 &&
              propertyDetail.buildings[0].construction.renovationYear
                ? propertyDetail.buildings[0].construction.renovationYear
                : '-'}
            </p>
          </div>
        */}
        </div>
      </CardContent>
    </Card>
  )

  // Detailed property information card that should show at the bottom
  const renderDetailedInfoCard = () => (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle>Fastighet</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Fastighetsnr:</p>
              <p className="font-medium">{propertyDetail.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kommun:</p>
              <p className="font-medium">{propertyDetail.municipality}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Församling:</p>
              <p className="font-medium">
                {propertyDetail.congregation || 'DOMKYRKOFÖRSAMLING'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ägan/Inhyrd:</p>
              <p className="font-medium">Egen</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Till datum:</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sammanföringsnr:</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Typ av sträckkod:</p>
              <p className="font-medium">(Ej angivet)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Fastighetsbeteckning:
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trakt:</p>
              <p className="font-medium">{propertyDetail.tract || 'Lundby'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hyresid:</p>
              <p className="font-medium">{propertyDetail.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fastighetsägare:</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Inskrivningsdatum:
              </p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Värdeområde:</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sträckkod:</p>
              <p className="font-medium">-</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Block:</p>
              <p className="font-medium">
                {propertyDetail.municipality || 'Lundby'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hyresobjekttyp:</p>
              <p className="font-medium">STD</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mt-1">
                Standard hyresobjekttyp
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Från datum:</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fångesdatum:</p>
              <p className="font-medium">-</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // If we're only showing the basic info card
  if (showBasicInfoOnly) {
    return renderBasicInfoCard()
  }

  // If we're only showing the detailed info card
  if (showDetailedInfo) {
    return renderDetailedInfoCard()
  }

  return renderBasicInfoCard()
}
