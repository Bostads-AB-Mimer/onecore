import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import type { Inspection } from '@/components/residence/inspection/types'
import { Card, CardContent } from '@/components/ui/v2/Card'

interface InspectionReadOnlyProps {
  inspection: Inspection
  onClose?: () => void
  isOpen?: boolean
}

export function InspectionReadOnly({
  inspection,
  onClose,
  isOpen,
}: InspectionReadOnlyProps) {
  const renderContent = () => (
    <>
      <div className="text-sm text-muted-foreground mt-2 mb-4">
        <p>
          Datum:{' '}
          {new Date(inspection.date) // yyyy-MM-dd HH:mm
            .toISOString()
            .slice(0, 16)
            .replace('T', ' ')}
        </p>
        <p>Besiktigad av: {inspection.inspectedBy}</p>
      </div>

      <div className="space-y-4">
        <Accordion type="single" collapsible className="space-y-2">
          {Object.entries(inspection.rooms).map(([roomId, room]) => (
            <AccordionItem
              key={roomId}
              value={roomId}
              className="rounded-lg border border-slate-200 bg-white"
            >
              <AccordionTrigger className="px-3 sm:px-4 py-3 hover:bg-accent/50">
                <h3 className="text-lg font-medium">Rum {roomId}</h3>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-4 pb-4 pt-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(room.conditions).map(
                      ([component, condition]) => (
                        <div key={component} className="space-y-2">
                          <h4 className="font-medium capitalize">
                            {component}
                          </h4>
                          <p className="text-sm">
                            Skick: {condition || 'Ej angivet'}
                          </p>
                          <div className="text-sm">
                            <p className="font-medium">Åtgärder:</p>
                            {room.actions[
                              component as keyof typeof room.actions
                            ].length > 0 ? (
                              <ul className="list-disc list-inside">
                                {room.actions[
                                  component as keyof typeof room.actions
                                ].map((action, index) => (
                                  <li key={index}>{action}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground">
                                Inga åtgärder registrerade
                              </p>
                            )}
                          </div>
                          {room.componentNotes[
                            component as keyof typeof room.componentNotes
                          ] && (
                            <div className="text-sm">
                              <p className="font-medium">Anteckningar:</p>
                              <p>
                                {
                                  room.componentNotes[
                                    component as keyof typeof room.componentNotes
                                  ]
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </>
  )

  if (isOpen !== undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose!}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Besiktningsprotokoll</DialogTitle>
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">{renderContent()}</CardContent>
    </Card>
  )
}
