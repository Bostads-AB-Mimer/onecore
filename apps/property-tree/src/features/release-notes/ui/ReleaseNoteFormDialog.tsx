import { useState } from 'react'

import {
  type CreateReleaseNote,
  RELEASE_NOTE_APP_GROUPS,
  RELEASE_NOTE_APP_LABELS,
  RELEASE_NOTE_CATEGORIES,
  RELEASE_NOTE_CATEGORY_LABELS,
  type ReleaseNote,
  type ReleaseNoteApp,
  type ReleaseNoteCategory,
} from '@/entities/release-note'

import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'

import {
  useCreateReleaseNote,
  useUpdateReleaseNote,
} from '../hooks/useReleaseNoteMutations'

interface FormState {
  title: string
  description: string
  category: ReleaseNoteCategory
  app: ReleaseNoteApp
  pinned: boolean
  published: boolean
  publishDate: string // YYYY-MM-DD, local time
}

// sv-SE formats dates as YYYY-MM-DD, which is what <input type="date"> wants.
const toDateInputValue = (date: Date) => date.toLocaleDateString('sv-SE')

function initialState(note: ReleaseNote | null): FormState {
  return {
    title: note?.title ?? '',
    description: note?.description ?? '',
    category: note?.category ?? 'feature',
    app: note?.app ?? 'property-tree',
    pinned: note?.pinned ?? false,
    published: note ? note.publishedAt !== null : false,
    publishDate: toDateInputValue(
      note?.publishedAt ? new Date(note.publishedAt) : new Date()
    ),
  }
}

// Keeps the original timestamp when the date is untouched. Today publishes
// now; any other date resolves to local midnight (future = scheduled).
function resolvePublishedAt(
  form: FormState,
  note: ReleaseNote | null
): string | null {
  if (!form.published) return null

  if (
    note?.publishedAt &&
    toDateInputValue(new Date(note.publishedAt)) === form.publishDate
  ) {
    return note.publishedAt
  }

  if (form.publishDate === toDateInputValue(new Date())) {
    return new Date().toISOString()
  }

  return new Date(`${form.publishDate}T00:00:00`).toISOString()
}

interface ReleaseNoteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The note being edited. Null = create a new note.
  note: ReleaseNote | null
}

export function ReleaseNoteFormDialog({
  open,
  onOpenChange,
  note,
}: ReleaseNoteFormDialogProps) {
  const createMutation = useCreateReleaseNote()
  const updateMutation = useUpdateReleaseNote()
  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (body: CreateReleaseNote) => {
    const onSuccess = () => onOpenChange(false)

    if (note) {
      updateMutation.mutate({ id: note.id, body }, { onSuccess })
    } else {
      createMutation.mutate(body, { onSuccess })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!isSaving) onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{note ? 'Redigera nyhet' : 'Ny nyhet'}</DialogTitle>
        </DialogHeader>

        {/* Unmounted while closed, so the form state is fresh on each open. */}
        <ReleaseNoteForm
          note={note}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface ReleaseNoteFormProps {
  note: ReleaseNote | null
  isSaving: boolean
  onSubmit: (body: CreateReleaseNote) => void
  onCancel: () => void
}

function ReleaseNoteForm({
  note,
  isSaving,
  onSubmit,
  onCancel,
}: ReleaseNoteFormProps) {
  const [form, setForm] = useState<FormState>(() => initialState(note))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const isValid =
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    (!form.published || form.publishDate.length > 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isSaving) return

    onSubmit({
      app: form.app,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      pinned: form.pinned,
      publishedAt: resolvePublishedAt(form, note),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="release-note-title">Rubrik</Label>
        <Input
          id="release-note-title"
          value={form.title}
          maxLength={255}
          onChange={(e) => set('title', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="release-note-description">Beskrivning</Label>
        <Textarea
          id="release-note-description"
          value={form.description}
          rows={6}
          onChange={(e) => set('description', e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Kategori</Label>
          <Select
            value={form.category}
            onValueChange={(value) =>
              set('category', value as ReleaseNoteCategory)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELEASE_NOTE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {RELEASE_NOTE_CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Gäller</Label>
          <Select
            value={form.app}
            onValueChange={(value) => set('app', value as ReleaseNoteApp)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELEASE_NOTE_APP_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.apps.map((app) => (
                    <SelectItem key={app} value={app}>
                      {RELEASE_NOTE_APP_LABELS[app]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="release-note-pinned"
          checked={form.pinned}
          onCheckedChange={(checked) => set('pinned', checked === true)}
        />
        <Label htmlFor="release-note-pinned">Fäst överst i listan</Label>
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="release-note-published"
            checked={form.published}
            onCheckedChange={(checked) => set('published', checked === true)}
          />
          <Label htmlFor="release-note-published">Publicera</Label>
        </div>
        {form.published ? (
          <div className="space-y-2">
            <Label htmlFor="release-note-publish-date">Publiceringsdatum</Label>
            <Input
              id="release-note-publish-date"
              type="date"
              className="w-fit"
              value={form.publishDate}
              onChange={(e) => set('publishDate', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Ett framtida datum schemalägger nyheten. Den visas först när
              datumet har passerat.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nyheten sparas som utkast och visas inte för användare.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Avbryt
        </Button>
        <Button type="submit" disabled={!isValid || isSaving}>
          {isSaving ? 'Sparar...' : 'Spara'}
        </Button>
      </DialogFooter>
    </form>
  )
}
