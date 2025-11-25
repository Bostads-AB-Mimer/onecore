import { Card, CardContent, CardHeader, CardTitle } from '../ui/v2/Card'
import type { ComponentInstance } from '@/services/types'

interface ComponentCardProps {
  component: ComponentInstance
}

export const ComponentCard = ({ component }: ComponentCardProps) => {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return `${value.toLocaleString('sv-SE')} kr`
  }

  const mapStatusToSwedish = (status: string | undefined) => {
    if (!status) return '-'
    const statusMap: Record<string, string> = {
      ACTIVE: 'Aktiv',
      INACTIVE: 'Inaktiv',
      MAINTENANCE: 'Underhåll',
      DECOMMISSIONED: 'Ur drift',
    }
    return statusMap[status] || status
  }

  const calculateAge = (installationDate: string | null | undefined) => {
    if (!installationDate) return null
    const installed = new Date(installationDate)
    const now = new Date()
    const years = now.getFullYear() - installed.getFullYear()
    return years > 0 ? years : 0
  }

  const formatYears = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return `${value} år`
  }

  const calculateWarrantyEnd = () => {
    if (!component.warrantyStartDate || !component.warrantyMonths) return null
    const startDate = new Date(component.warrantyStartDate)
    startDate.setMonth(startDate.getMonth() + component.warrantyMonths)
    return startDate.toISOString()
  }

  const installation = component.componentInstallations?.[0]
  const age = calculateAge(installation?.installationDate)
  const installationYear = installation?.installationDate
    ? new Date(installation.installationDate).getFullYear()
    : null

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">
              {component.model?.componentType?.description || '-'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {component.model?.subtype?.description || '\u00A0'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fabrikat:</span>
            <span className="font-medium">
              {component.model?.manufacturer || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Serienummer:</span>
            <span className="font-medium">{component.serialNumber || '-'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Specifikation:</span>
            <span className="font-medium">
              {component.specifications || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Installationsdatum:</span>
            <span className="font-medium">
              {formatDate(installation?.installationDate)}
            </span>
          </div>
          {installationYear && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Byggår:</span>
              <span className="font-medium">{installationYear}</span>
            </div>
          )}
          {component.status && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">
                {mapStatusToSwedish(component.status)}
              </span>
            </div>
          )}
          {component.priceAtPurchase !== null &&
            component.priceAtPurchase !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">A-pris:</span>
                <span className="font-medium">
                  {formatCurrency(component.priceAtPurchase)}
                </span>
              </div>
            )}
          {age !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ålder:</span>
              <span className="font-medium">{formatYears(age)}</span>
            </div>
          )}
          {component.model?.technicalLifespan !== null &&
            component.model?.technicalLifespan !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Teknisk livslängd:
                </span>
                <span className="font-medium">
                  {formatYears(component.model.technicalLifespan)}
                </span>
              </div>
            )}
          {component.model?.economicLifespan !== null &&
            component.model?.economicLifespan !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Ekonomisk livslängd:
                </span>
                <span className="font-medium">
                  {formatYears(component.model.economicLifespan)}
                </span>
              </div>
            )}
          {component.warrantyMonths !== null &&
            component.warrantyMonths !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Garantitid:</span>
                <span className="font-medium">
                  {formatYears(Math.round(component.warrantyMonths / 12))}
                </span>
              </div>
            )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Garanti t.o.m:</span>
            <span className="font-medium">
              {formatDate(calculateWarrantyEnd())}
            </span>
          </div>
          {component.model?.dimensions && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mått:</span>
              <span className="font-medium">{component.model.dimensions}</span>
            </div>
          )}
          {component.ncsCode && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">NCS-kod:</span>
              <span className="font-medium">{component.ncsCode}</span>
            </div>
          )}
          {component.model?.coclassCode && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CoClass-kod:</span>
              <span className="font-medium">{component.model.coclassCode}</span>
            </div>
          )}
          {component.model?.installationInstructions && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dokumentation:</span>
              <span className="font-medium">
                {component.model.installationInstructions}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
