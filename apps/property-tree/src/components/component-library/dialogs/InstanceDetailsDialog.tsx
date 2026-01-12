import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import { Badge } from '@/components/ui/v2/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import type { ComponentInstance } from '@/services/types'

interface InstanceDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  instance: ComponentInstance
}

export const InstanceDetailsDialog = ({
  isOpen,
  onClose,
  instance,
}: InstanceDetailsDialogProps) => {
  const getStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'ACTIVE':
        return 'default'
      case 'INACTIVE':
        return 'secondary'
      case 'MAINTENANCE':
        return 'outline'
      case 'DECOMMISSIONED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'Aktiv'
      case 'INACTIVE':
        return 'Inaktiv'
      case 'MAINTENANCE':
        return 'Underhåll'
      case 'DECOMMISSIONED':
        return 'Ur drift'
      default:
        return status
    }
  }

  const getConditionLabel = (
    condition: string | null | undefined
  ): string => {
    switch (condition) {
      case 'NEW':
        return 'Nyskick'
      case 'GOOD':
        return 'Gott skick'
      case 'FAIR':
        return 'Godtagbart skick'
      case 'POOR':
        return 'Dåligt skick'
      case 'DAMAGED':
        return 'Skadat'
      default:
        return '-'
    }
  }

  const getConditionVariant = (
    condition: string | null | undefined
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (condition) {
      case 'NEW':
        return 'default'
      case 'GOOD':
        return 'default'
      case 'FAIR':
        return 'secondary'
      case 'POOR':
        return 'outline'
      case 'DAMAGED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Komponentdetaljer</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {instance.serialNumber}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="font-semibold mb-3">Grundinformation</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={getStatusVariant(instance.status)}>
                    {getStatusLabel(instance.status)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Skick</dt>
                <dd>
                  <Badge variant={getConditionVariant(instance.condition)}>
                    {getConditionLabel(instance.condition)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Serienummer</dt>
                <dd className="text-sm font-medium">{instance.serialNumber}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Antal</dt>
                <dd className="text-sm font-medium">{instance.quantity}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Inköpspris</dt>
                <dd className="text-sm font-medium">
                  {instance.priceAtPurchase} kr
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Avskrivningspris
                </dt>
                <dd className="text-sm font-medium">
                  {instance.depreciationPriceAtPurchase} kr
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Garantistart</dt>
                <dd className="text-sm font-medium">
                  {formatDate(instance.warrantyStartDate)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Garanti (månader)
                </dt>
                <dd className="text-sm font-medium">
                  {instance.warrantyMonths} mån
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Ekonomisk livslängd
                </dt>
                <dd className="text-sm font-medium">
                  {instance.economicLifespan} år
                </dd>
              </div>
              {instance.ncsCode && (
                <div>
                  <dt className="text-sm text-muted-foreground">NCS-kod</dt>
                  <dd className="text-sm font-medium">{instance.ncsCode}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Installation History */}
          <div>
            <h3 className="font-semibold mb-3">Installationshistorik</h3>
            {instance.componentInstallations &&
            instance.componentInstallations.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Installationsdatum</TableHead>
                      <TableHead>Avinstallationsdatum</TableHead>
                      <TableHead>Rum</TableHead>
                      <TableHead>Kostnad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instance.componentInstallations.map((install) => (
                      <TableRow key={install.id}>
                        <TableCell>
                          {formatDate(install.installationDate)}
                        </TableCell>
                        <TableCell>
                          {install.deinstallationDate ? (
                            formatDate(install.deinstallationDate)
                          ) : (
                            <Badge variant="default">Aktiv</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {install.spaceId || 'N/A'}
                        </TableCell>
                        <TableCell>{install.cost || 0} kr</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                Inga installationer ännu
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
