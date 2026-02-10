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
import { Trash2, Unplug } from 'lucide-react'
import { DeinstallationDialog } from './DeinstallationDialog'
import { ComponentInstallationForm } from './ComponentInstallationForm'
import type { Component } from '@/services/types'
import { formatISODate } from '@/utils/formatters'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { componentService } from '@/services/api/core/componentService'
import { componentLibraryService } from '@/services/api/core/componentLibraryService'

interface ManageComponentsDialogProps {
  isOpen: boolean
  onClose: () => void
  spaceId: string
  spaceName?: string
}

export const ManageComponentsDialog = ({
  isOpen,
  onClose,
  spaceId,
  spaceName,
}: ManageComponentsDialogProps) => {
  const queryClient = useQueryClient()
  const [deinstallDialogState, setDeinstallDialogState] = useState<{
    isOpen: boolean
    component?: Component
  }>({
    isOpen: false,
  })

  const { data: spaceComponents = [] } = useQuery({
    queryKey: ['components', spaceId],
    queryFn: () => componentService.getByRoomId(spaceId),
    enabled: isOpen,
  })

  const deleteComponent = useMutation({
    mutationFn: (componentId: string) =>
      componentLibraryService.deleteInstance(componentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', spaceId] })
    },
  })

  const handleDeinstallClick = (component: Component) => {
    setDeinstallDialogState({
      isOpen: true,
      component,
    })
  }

  const handleDeleteClick = async (component: Component) => {
    if (
      window.confirm(
        `Är du säker på att du vill ta bort komponenten "${component.serialNumber}" permanent? Detta kan inte ångras.`
      )
    ) {
      await deleteComponent.mutateAsync(component.id)
    }
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
            {spaceName && (
              <p className="text-sm text-muted-foreground">{spaceName}</p>
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
                  propertyObjectId={spaceId}
                  onSuccess={onClose}
                  onCancel={onClose}
                />
              )}
            </TabsContent>

            {/* Uninstallation Tab */}
            <TabsContent value="avinstallera">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Välj en komponent att avinstallera eller ta bort permanent
                </p>

                {spaceComponents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Inga komponenter installerade
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {spaceComponents.map((component) => {
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
                                {formatISODate(
                                  activeInstallation.installationDate
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeinstallClick(component)}
                              disabled={!activeInstallation}
                              title={
                                !activeInstallation
                                  ? 'Komponenten är inte installerad'
                                  : undefined
                              }
                            >
                              <Unplug className="h-4 w-4 mr-2" />
                              Avinstallera
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteClick(component)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Ta bort
                            </Button>
                          </div>
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
          spaceId={spaceId}
        />
      )}
    </>
  )
}
