import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/v2/Button'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/v2/Tabs'
import { Trash2 } from 'lucide-react'
import { DeinstallationDialog } from './DeinstallationDialog'
import { ComponentInstallationForm } from './ComponentInstallationForm'
import type { ComponentInstance } from '@/services/types'
import { useQuery } from '@tanstack/react-query'
import { componentService } from '@/services/api/core/componentService'

interface ManageRoomComponentsDialogProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  propertyObjectId: string
  roomName?: string
}

export const ManageRoomComponentsDialog = ({
  isOpen,
  onClose,
  roomId,
  propertyObjectId,
  roomName,
}: ManageRoomComponentsDialogProps) => {
  const [deinstallDialogState, setDeinstallDialogState] = useState<{
    isOpen: boolean
    component?: ComponentInstance
  }>({
    isOpen: false,
  })

  const { data: roomComponents = [] } = useQuery({
    queryKey: ['components', propertyObjectId],
    queryFn: () => componentService.getByRoomId(propertyObjectId),
    enabled: isOpen,
  })

  const handleDeinstallClick = (component: ComponentInstance) => {
    setDeinstallDialogState({
      isOpen: true,
      component,
    })
  }

  const handleCloseDeinstallDialog = () => {
    setDeinstallDialogState({
      isOpen: false,
      component: undefined,
    })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hantera komponenter</DialogTitle>
            {roomName && (
              <p className="text-sm text-muted-foreground">Rum: {roomName}</p>
            )}
          </DialogHeader>

          <Tabs defaultValue="installera" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="installera" className="flex-1">
                Installera
              </TabsTrigger>
              <TabsTrigger value="avinstallera" className="flex-1">
                Avinstallera
              </TabsTrigger>
            </TabsList>

            {/* Installation Tab */}
            <TabsContent value="installera">
              {isOpen && (
                <ComponentInstallationForm
                  propertyObjectId={propertyObjectId}
                  roomId={roomId}
                  onSuccess={onClose}
                  onCancel={onClose}
                />
              )}
            </TabsContent>

            {/* Uninstallation Tab */}
            <TabsContent value="avinstallera">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Välj en komponent att avinstallera från rummet
                </p>

                {roomComponents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Inga komponenter installerade i detta rum
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roomComponents.map((component) => {
                      const activeInstallation =
                        component.componentInstallations?.find(
                          (inst) => !inst.deinstallationDate
                        )

                      return (
                        <div
                          key={component.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {component.model?.subtype?.componentType?.category
                                ?.categoryName || ''}{' '}
                              - {component.model?.manufacturer}{' '}
                              {component.model?.modelName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              SN: {component.serialNumber}
                            </p>
                            {activeInstallation && (
                              <p className="text-xs text-muted-foreground">
                                Installerad:{' '}
                                {new Date(
                                  activeInstallation.installationDate
                                ).toLocaleDateString('sv-SE')}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeinstallClick(component)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Avinstallera
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Deinstallation dialog */}
      {deinstallDialogState.component && (
        <DeinstallationDialog
          isOpen={deinstallDialogState.isOpen}
          onClose={handleCloseDeinstallDialog}
          component={deinstallDialogState.component}
          roomId={roomId}
        />
      )}
    </>
  )
}
