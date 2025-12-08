import { Button } from '@/components/ui/v2/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Plus, Save, Pin, PinOff, Trash2 } from 'lucide-react'
import { useNotesState } from './hooks/useNotesState'
import type { NotesProps, Note } from './types'

export function Notes({
  entityType,
  entityId,
  title = 'Noteringar',
  placeholder = 'Skriv din notering här...',
  emptyMessage = 'Inga noteringar har lagts till ännu.',
  categories = [],
  showCategory = false,
}: NotesProps) {
  const {
    state,
    sortedNotes,
    handleAddNote,
    handleDeleteNote,
    handleTogglePin,
    startAddingNote,
    cancelAddingNote,
    updateNewNote,
  } = useNotesState(entityType, entityId, categories)

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
    return new Date(dateString).toLocaleDateString('sv-SE', options)
  }

  return (
    <div className="space-y-4">
      {/* Add note button */}
      {!state.isAddingNote && (
        <div className="flex justify-start">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={startAddingNote}
          >
            <Plus className="h-4 w-4" />
            Ny notering
          </Button>
        </div>
      )}

      {/* Add note form */}
      {state.isAddingNote && (
        <div className="border p-3 rounded-md bg-muted/20 space-y-3">
          <Textarea
            placeholder={placeholder}
            className="min-h-[80px] text-sm"
            value={state.newNote}
            onChange={(e) => updateNewNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelAddingNote}>
              Avbryt
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              className="flex items-center gap-1"
            >
              <Save className="h-4 w-4" />
              Spara
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {sortedNotes.length === 0 ? (
        <p className="text-muted-foreground text-center py-4 text-sm">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note: Note) => (
            <div
              key={note.id}
              className={`border rounded-md p-3 ${note.isPinned ? 'bg-amber-50 border-amber-200' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {note.isPinned && (
                    <Pin className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  )}
                  <p className="text-xs text-muted-foreground truncate">
                    {formatDate(note.createdAt)} av {note.createdBy}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-amber-600"
                    onClick={() => handleTogglePin(note.id)}
                    title={note.isPinned ? 'Ta bort pin' : 'Pinna notering'}
                  >
                    {note.isPinned ? (
                      <PinOff className="h-4 w-4" />
                    ) : (
                      <Pin className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteNote(note.id)}
                    title="Ta bort notering"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
