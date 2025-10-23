import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Loader2 } from 'lucide-react'
import { keyNoteService } from '@/services/api/keyNoteService'
import type { KeyNote } from '@/services/types'

type Props = {
  rentalObjectCode: string
}

export function RentalObjectNotes({ rentalObjectCode }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<KeyNote | null>(null)
  const [description, setDescription] = useState('')

  // Load existing note when dialog opens
  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadNote() {
      setLoading(true)
      try {
        const notes =
          await keyNoteService.getKeyNotesByRentalObjectCode(rentalObjectCode)
        if (!cancelled) {
          // Assume one note per rental object
          const existingNote = notes[0] ?? null
          setNote(existingNote)
          setDescription(existingNote?.description ?? '')
        }
      } catch (err) {
        console.error('Failed to load note:', err)
        if (!cancelled) {
          setNote(null)
          setDescription('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadNote()

    return () => {
      cancelled = true
    }
  }, [open, rentalObjectCode])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (note) {
        // Update existing note
        const updated = await keyNoteService.updateKeyNote(note.id, {
          description,
        })
        setNote(updated)
      } else {
        // Create new note
        const created = await keyNoteService.createKeyNote({
          rentalObjectCode,
          description,
        })
        setNote(created)
      }
      setOpen(false)
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Misslyckades med att spara noteringen')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
    // Reset to original value when canceling
    setDescription(note?.description ?? '')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
          <FileText className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Noteringar för objekt {rentalObjectCode}</DialogTitle>
          <DialogDescription>
            Lägg till eller redigera Noteringar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Skriv dina noteringar här..."
              rows={8}
              className="resize-none"
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading || saving}
          >
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sparar...
              </>
            ) : (
              'Spara'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
