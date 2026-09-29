import { useState } from 'react'
import { Pencil, Pin, Plus, Trash2 } from 'lucide-react'

import {
  DeleteReleaseNoteDialog,
  ReleaseNoteFormDialog,
} from '@/features/release-notes'

import {
  formatReleaseNoteDate,
  getReleaseNoteStatus,
  RELEASE_NOTE_APP_LABELS,
  RELEASE_NOTE_BADGE_STYLES,
  RELEASE_NOTE_CATEGORY_LABELS,
  type ReleaseNote,
  type ReleaseNoteStatus,
  useReleaseNotes,
} from '@/entities/release-note'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { ViewLayout } from '@/shared/ui/layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

const STATUS_LABELS: Record<ReleaseNoteStatus, string> = {
  draft: 'Utkast',
  scheduled: 'Schemalagd',
  published: 'Publicerad',
}

const STATUS_STYLES: Record<ReleaseNoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  scheduled:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  published:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export function ReleaseNotesAdminPage() {
  const { data, isLoading, isError } = useReleaseNotes({ includeDrafts: true })

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<ReleaseNote | null>(null)
  const [deletingNote, setDeletingNote] = useState<ReleaseNote | null>(null)

  const openCreate = () => {
    setEditingNote(null)
    setIsFormOpen(true)
  }

  const openEdit = (note: ReleaseNote) => {
    setEditingNote(note)
    setIsFormOpen(true)
  }

  const notes = data?.notes ?? []

  if (isLoading) {
    return (
      <ViewLayout>
        <p className="text-sm text-muted-foreground">Laddar...</p>
      </ViewLayout>
    )
  }

  if (isError) {
    return (
      <ViewLayout>
        <p className="text-sm text-muted-foreground">
          Kunde inte hämta nyheter.
        </p>
      </ViewLayout>
    )
  }

  // UI gate only. Core enforces release-notes:write on every write.
  if (!data?.canManage) {
    return (
      <ViewLayout>
        <h1 className="text-2xl font-bold">Hantera nyheter</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Du saknar behörighet att hantera nyheter.
        </p>
      </ViewLayout>
    )
  }

  return (
    <ViewLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Hantera nyheter</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Skapa, redigera och ta bort nyheter och uppdateringar
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus />
            Ny nyhet
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rubrik</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Gäller</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Skapad av</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      Inga nyheter ännu.
                    </TableCell>
                  </TableRow>
                )}
                {notes.map((note) => {
                  const status = getReleaseNoteStatus(note)
                  return (
                    <TableRow key={note.id}>
                      <TableCell className="font-medium max-w-md">
                        <div className="flex items-center gap-2">
                          {note.pinned && (
                            <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate" title={note.title}>
                            {note.title}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={RELEASE_NOTE_BADGE_STYLES[note.category]}
                        >
                          {RELEASE_NOTE_CATEGORY_LABELS[note.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>{RELEASE_NOTE_APP_LABELS[note.app]}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[status]}>
                          {STATUS_LABELS[status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {note.publishedAt
                          ? formatReleaseNoteDate(note.publishedAt)
                          : '—'}
                      </TableCell>
                      <TableCell>{note.createdBy ?? '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(note)}
                          title="Redigera"
                        >
                          <Pencil />
                          <span className="sr-only">Redigera</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingNote(note)}
                          title="Ta bort"
                        >
                          <Trash2 />
                          <span className="sr-only">Ta bort</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ReleaseNoteFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        note={editingNote}
      />
      <DeleteReleaseNoteDialog
        note={deletingNote}
        onOpenChange={(open) => {
          if (!open) setDeletingNote(null)
        }}
      />
    </ViewLayout>
  )
}
