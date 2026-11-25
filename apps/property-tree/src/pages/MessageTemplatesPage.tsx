import { useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'

import {
  ArchiveMessageTemplateDialog,
  MessageTemplateFormDialog,
  useRestoreMessageTemplate,
} from '@/features/message-templates'

import {
  type MessageTemplate,
  useMessageTemplates,
} from '@/entities/message-template'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Label } from '@/shared/ui/Label'
import { ViewLayout } from '@/shared/ui/layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export function MessageTemplatesPage() {
  const [showArchived, setShowArchived] = useState(false)
  const { data, isLoading, isError } = useMessageTemplates(
    showArchived ? 'all' : 'active'
  )

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null)
  const [archivingTemplate, setArchivingTemplate] =
    useState<MessageTemplate | null>(null)
  const restoreMutation = useRestoreMessageTemplate()

  const openCreate = () => {
    setEditingTemplate(null)
    setIsFormOpen(true)
  }

  const openEdit = (template: MessageTemplate) => {
    setEditingTemplate(template)
    setIsFormOpen(true)
  }

  const templates = data ?? []

  return (
    <ViewLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mallar</h1>
            <p className="text-muted-foreground text-sm mt-1">
              SMS-texter att utgå från i SMS-dialogen. Arkiverade mallar kan
              inte väljas men syns fortfarande i loggen.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus />
            Ny mall
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <Label htmlFor="show-archived" className="text-sm font-normal">
            Visa arkiverade mallar
          </Label>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-6">Laddar...</p>
            ) : isError ? (
              <p className="text-sm text-destructive p-6">
                Kunde inte hämta mallar. Försök igen senare.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Uppdaterad
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-8"
                      >
                        Inga mallar ännu.
                      </TableCell>
                    </TableRow>
                  )}
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium max-w-xs">
                        <span className="truncate block" title={template.name}>
                          {template.name}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span
                          className="line-clamp-2 text-sm text-muted-foreground whitespace-pre-wrap break-words"
                          title={template.body}
                        >
                          {template.body}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(template.updatedAt)}
                      </TableCell>
                      <TableCell>
                        {template.isActive ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Aktiv
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            Arkiverad
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(template)}
                          title="Redigera"
                        >
                          <Pencil />
                          <span className="sr-only">Redigera</span>
                        </Button>
                        {template.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setArchivingTemplate(template)}
                            title="Arkivera"
                          >
                            <Archive />
                            <span className="sr-only">Arkivera</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => restoreMutation.mutate(template.id)}
                            disabled={
                              restoreMutation.isPending &&
                              restoreMutation.variables === template.id
                            }
                            title="Återställ"
                          >
                            <ArchiveRestore />
                            <span className="sr-only">Återställ</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <MessageTemplateFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        template={editingTemplate}
      />
      <ArchiveMessageTemplateDialog
        template={archivingTemplate}
        onOpenChange={(open) => {
          if (!open) setArchivingTemplate(null)
        }}
      />
    </ViewLayout>
  )
}
