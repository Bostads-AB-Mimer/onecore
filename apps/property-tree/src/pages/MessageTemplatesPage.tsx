import { useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'

import {
  ArchiveMessageTemplateDialog,
  MessageTemplateFormDialog,
  type TemplateEditTarget,
  useRestoreMessageTemplate,
} from '@/features/message-templates'

import {
  type MessageTemplate,
  useMessageTemplates,
} from '@/entities/message-template'
import { useSystemTemplates } from '@/entities/system-template'

import { formatTimestamp } from '@/shared/lib/formatters'
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

function ChangedCell({
  updatedAt,
  updatedBy,
}: {
  updatedAt: string
  updatedBy: string | null
}) {
  return (
    <TableCell className="whitespace-nowrap text-sm">
      {formatTimestamp(updatedAt)}
      {updatedBy && (
        <span className="block text-xs text-muted-foreground">
          av {updatedBy}
        </span>
      )}
    </TableCell>
  )
}

export function MessageTemplatesPage() {
  const [showArchived, setShowArchived] = useState(false)
  const { data, isLoading, isError } = useMessageTemplates(
    showArchived ? 'all' : 'active'
  )
  const systemQuery = useSystemTemplates()

  const [editing, setEditing] = useState<TemplateEditTarget | null>(null)
  const [archivingTemplate, setArchivingTemplate] =
    useState<MessageTemplate | null>(null)
  const restoreMutation = useRestoreMessageTemplate()

  const templates = data ?? []
  const systemTemplates = systemQuery.data?.templates ?? []
  const canEditSystem = systemQuery.data?.capabilities.canEdit ?? false

  return (
    <ViewLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Mallar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Mejl som ONECore skickar automatiskt, och SMS-texter att utgå från i
            SMS-dialogen.
          </p>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Systemmejl</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Till exempel erbjudanden om bilplats, fakturor och meddelanden i
              ärenden. En ändring gäller från nästa mejl som skickas.
              {!canEditSystem &&
                systemQuery.isSuccess &&
                ' Du har inte behörighet att ändra mejlen.'}
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              {systemQuery.isLoading ? (
                <p className="text-sm text-muted-foreground p-6">Laddar...</p>
              ) : systemQuery.isError ? (
                <p className="text-sm text-destructive p-6">
                  Kunde inte hämta mejlen. Försök igen senare.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Namn</TableHead>
                      <TableHead>Ämnesrad</TableHead>
                      <TableHead className="whitespace-nowrap">
                        Ändrad
                      </TableHead>
                      {canEditSystem && (
                        <TableHead className="text-right">Åtgärder</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemTemplates.map((template) => (
                      <TableRow key={template.key}>
                        <TableCell className="font-medium max-w-xs">
                          {template.name}
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-muted-foreground">
                          <span className="line-clamp-2 break-words">
                            {template.subject}
                          </span>
                        </TableCell>
                        <ChangedCell
                          updatedAt={template.updatedAt}
                          updatedBy={template.updatedBy}
                        />
                        {canEditSystem && (
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setEditing({ kind: 'system', template })
                              }
                              title="Redigera"
                            >
                              <Pencil />
                              <span className="sr-only">Redigera</span>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">SMS-mallar</h2>
              <p className="text-muted-foreground text-sm mt-1">
                SMS-texter att utgå från i SMS-dialogen. Arkiverade mallar kan
                inte väljas men syns fortfarande i loggen.
              </p>
            </div>
            <Button onClick={() => setEditing({ kind: 'sms', template: null })}>
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
                        Ändrad
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
                          <span
                            className="truncate block"
                            title={template.name}
                          >
                            {template.name}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <span
                            className="line-clamp-2 text-sm text-muted-foreground whitespace-pre-wrap break-words"
                            title={template.smsText}
                          >
                            {template.smsText}
                          </span>
                        </TableCell>
                        <ChangedCell
                          updatedAt={template.updatedAt}
                          updatedBy={template.updatedBy}
                        />
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
                            onClick={() =>
                              setEditing({ kind: 'sms', template })
                            }
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
                              onClick={() =>
                                restoreMutation.mutate(template.id)
                              }
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
        </section>
      </div>

      <MessageTemplateFormDialog
        target={editing}
        onClose={() => setEditing(null)}
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
