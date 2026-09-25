import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { Eye, Plus, Save, Trash2, Upload } from 'lucide-react'

import { type GuideWithUrls, useGuideCategories } from '@/entities/guide'

import { useToast } from '@/shared/hooks/useToast'
import { paths, routes } from '@/shared/routes'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/AlertDialog'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { SortableList } from '@/shared/ui/SortableList'
import { Textarea } from '@/shared/ui/Textarea'

import { useCreateGuide } from '../hooks/useCreateGuide'
import { useDeleteGuide } from '../hooks/useDeleteGuide'
import { useGuideEditorState } from '../hooks/useGuideEditorState'
import { useRevokeObjectUrls } from '../hooks/useRevokeObjectUrls'
import { useStepImageRequests } from '../hooks/useStepImageRequests'
import { useUpdateGuide } from '../hooks/useUpdateGuide'
import { useUploadPendingImages } from '../hooks/useUploadPendingImages'
import {
  type GuideStatus,
  isDirty,
  pendingImagesByStep,
  pendingImageUrls,
  toPreview,
  toRequest,
  toUpdateRequest,
  validate,
} from '../lib/editorState'
import { saveErrorMessage } from '../lib/errorMessages'
import { blocksImplicitSubmit } from '../lib/implicitSubmit'
import { CategoryPicker } from './CategoryPicker'
import { DeleteGuideDialog } from './DeleteGuideDialog'
import { GuideView } from './GuideView'
import { StepEditor } from './StepEditor'

interface GuideEditorProps {
  initialGuide?: GuideWithUrls
  authorName: string
}

/** Shown on the save buttons while images are uploading or being deleted. */
const PENDING_IMAGES_HINT = 'Vänta tills bildändringarna har sparats'

export function GuideEditor({ initialGuide, authorName }: GuideEditorProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [state, dispatch] = useGuideEditorState(initialGuide)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { data: categories } = useGuideCategories()
  // Image uploads and deletes persist immediately and move the guide's
  // updatedAt, but only reach state once they finish. Saving meanwhile would
  // drop an uploaded image, or race the request into a 409.
  const { requests: imageRequests, inFlight: imageRequestsInFlight } =
    useStepImageRequests(dispatch)

  const createGuide = useCreateGuide()
  const updateGuide = useUpdateGuide()
  const deleteGuide = useDeleteGuide()
  const { uploadPendingImages, isUploading: isUploadingPending } =
    useUploadPendingImages(dispatch)
  // Uploading the images queued on unsaved steps is part of saving.
  const isSaving =
    createGuide.isPending || updateGuide.isPending || isUploadingPending
  const dirty = isDirty(state)
  useRevokeObjectUrls(pendingImageUrls(state))

  // Block in-app navigation and tab close while there are unsaved changes.
  // Programmatic redirects after a save or delete set the ref so the blocker
  // lets that one navigation through even though the closure still sees the
  // pre-dispatch state.
  const allowNextNavigation = useRef(false)
  // Set while the blocker dialog's "Lämna sidan" closes the dialog.
  const proceedingNavigation = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowNextNavigation.current) {
      allowNextNavigation.current = false
      return false
    }
    return dirty && currentLocation.pathname !== nextLocation.pathname
  })
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const save = async (status: GuideStatus) => {
    if (isSaving || imageRequestsInFlight > 0) return

    const problems = validate(state, status)
    if (problems.length > 0) {
      toast({
        title:
          status === 'published'
            ? 'Guiden kan inte publiceras än'
            : 'Guiden kan inte sparas än',
        description: problems.join(' '),
        variant: 'destructive',
      })
      return
    }

    // Taken from the same state as the request, so every queued image belongs
    // to a step the save creates.
    const pendingImages = pendingImagesByStep(state)
    const isCreate = state.guideId === null

    let saved: GuideWithUrls
    try {
      saved =
        state.guideId === null
          ? await createGuide.mutateAsync(toRequest(state, status))
          : await updateGuide.mutateAsync({
              id: state.guideId,
              body: toUpdateRequest(state, status),
            })
    } catch (error) {
      toast({
        title: 'Det gick inte att spara',
        description: saveErrorMessage(error),
        variant: 'destructive',
      })
      return
    }

    // 'saved' keeps the queued images, which are then replaced one by one
    // as their uploads finish (or marked as failed).
    dispatch({ type: 'saved', guide: saved })
    const { failed } = await uploadPendingImages(saved, pendingImages)

    if (failed > 0) {
      toast({
        title: 'Bilder kunde inte laddas upp',
        description: `Guiden sparades men ${failed} ${failed === 1 ? 'bild' : 'bilder'} kunde inte laddas upp. Försök spara igen.`,
        variant: 'destructive',
      })
    } else {
      toast({
        title:
          !isCreate && status === 'published'
            ? 'Guiden är publicerad'
            : 'Guiden är sparad',
      })
    }

    // The editor for a new guide is replaced by one on the edit route, which
    // starts from the query cache (updated with the uploaded images). Images
    // that failed to upload would be lost there, so it stays until they are
    // all uploaded. An existing guide keeps its editor when the slug changes.
    const leaveNewGuideRoute = initialGuide === undefined && failed === 0
    const slugChanged =
      initialGuide !== undefined && saved.slug !== state.savedSlug
    if (leaveNewGuideRoute || slugChanged) {
      allowNextNavigation.current = true
      navigate(paths.guideEdit(saved.slug), { replace: true })
    }
  }

  const remove = async () => {
    if (!state.guideId) return
    try {
      await deleteGuide.mutateAsync(state.guideId)
      toast({ title: 'Guiden är borttagen' })
      setDeleteOpen(false)
      allowNextNavigation.current = true
      navigate(routes.guides, { replace: true })
    } catch {
      toast({
        title: 'Guiden kunde inte tas bort',
        description: 'Försök igen om en stund.',
        variant: 'destructive',
      })
    }
  }

  const isPublished = state.status === 'published' && !dirty
  const isUploading = imageRequestsInFlight > 0 || isUploadingPending
  const saveDisabled = isSaving || isUploading

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save(state.status)
      }}
      onKeyDown={(event) => {
        // Saving is always an explicit button press here, never an implicit
        // submit from Enter in a single-line field.
        if (
          blocksImplicitSubmit(
            event.key,
            event.target,
            event.nativeEvent.isComposing
          )
        ) {
          event.preventDefault()
        }
      }}
    >
      {/* min-w-0 neutralises the fieldset's default min-inline-size:
          min-content, which would otherwise stop its content from shrinking. */}
      <fieldset className="space-y-8 min-w-0" disabled={isSaving}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {dirty
              ? 'Osparade ändringar'
              : state.guideId
                ? isPublished
                  ? 'Publicerad'
                  : 'Sparad som utkast'
                : 'Ny guide'}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Förhandsgranska
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saveDisabled}
              title={isUploading ? PENDING_IMAGES_HINT : undefined}
              onClick={() => save('draft')}
            >
              <Save className="mr-2 h-4 w-4" />
              {state.status === 'published' && state.guideId
                ? 'Avpublicera och spara'
                : 'Spara utkast'}
            </Button>
            <Button
              type="button"
              disabled={saveDisabled}
              title={isUploading ? PENDING_IMAGES_HINT : undefined}
              onClick={() => save('published')}
            >
              <Upload className="mr-2 h-4 w-4" />
              {state.status === 'published'
                ? 'Spara och publicera'
                : 'Publicera'}
            </Button>
          </div>
          {isUploading && (
            <p
              className="w-full text-sm text-muted-foreground"
              aria-live="polite"
            >
              {PENDING_IMAGES_HINT}
            </p>
          )}
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="guide-title">Titel</Label>
            <Input
              id="guide-title"
              value={state.title}
              onChange={(event) =>
                dispatch({ type: 'set-title', title: event.target.value })
              }
              placeholder="T.ex. Registrera uppsägning i Tenfast"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="guide-description">Beskrivning</Label>
            <Textarea
              id="guide-description"
              value={state.description}
              onChange={(event) =>
                dispatch({
                  type: 'set-description',
                  description: event.target.value,
                })
              }
              placeholder="En eller två meningar om vad guiden hjälper till med"
              rows={2}
              maxLength={1000}
            />
          </div>
          <CategoryPicker
            value={state.category}
            onChange={(category) =>
              dispatch({ type: 'set-category', category })
            }
          />
          <div className="space-y-2">
            <Label htmlFor="guide-slug">Länkadress</Label>
            <div className="flex items-center gap-1 text-sm">
              <span className="shrink-0 text-muted-foreground">/guider/</span>
              <Input
                id="guide-slug"
                value={state.slug}
                onChange={(event) =>
                  dispatch({ type: 'set-slug', slug: event.target.value })
                }
                maxLength={200}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                aria-describedby="guide-slug-help"
              />
            </div>
            <p id="guide-slug-help" className="text-xs text-muted-foreground">
              {state.savedSlug && state.slug !== state.savedSlug
                ? 'Gamla länkar till guiden slutar fungera när adressen ändras.'
                : 'Följer titeln tills du ändrar den själv.'}
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Steg</h2>
          {state.steps.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Guiden har inga steg än.
            </p>
          ) : (
            <SortableList
              items={state.steps}
              getId={(step) => step.id}
              onMove={(from, to) => dispatch({ type: 'move-step', from, to })}
              renderItem={(step, index, handle) => (
                <StepEditor
                  guideId={state.guideId}
                  // status only changes on load and save, so it is the
                  // status stored on the server, which decides the upload rule.
                  guidePublished={state.status === 'published'}
                  step={step}
                  index={index}
                  total={state.steps.length}
                  handle={handle}
                  dispatch={dispatch}
                  imageRequests={imageRequests}
                  disabled={isSaving}
                />
              )}
            />
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() =>
              dispatch({ type: 'add-step', id: crypto.randomUUID() })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Lägg till steg
          </Button>
        </section>

        {state.guideId && (
          <section className="border-t pt-6">
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Ta bort guiden
            </Button>
          </section>
        )}
      </fieldset>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Förhandsgranskning</DialogTitle>
          </DialogHeader>
          <GuideView
            guide={toPreview(state, authorName, categories)}
            variant="page"
          />
        </DialogContent>
      </Dialog>

      <DeleteGuideDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={state.title || 'Namnlös guide'}
        isDeleting={deleteGuide.isPending}
        onConfirm={remove}
      />

      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          // Escape and outside clicks close the dialog without hitting a
          // button, so the blocker has to be released here too. Radix also
          // closes on "Lämna sidan", where the blocker is already proceeding.
          if (open) return
          if (proceedingNavigation.current) {
            proceedingNavigation.current = false
            return
          }
          blocker.reset?.()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lämna utan att spara?</AlertDialogTitle>
            <AlertDialogDescription>
              Du har osparade ändringar som går förlorade om du lämnar sidan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stanna kvar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                proceedingNavigation.current = true
                blocker.proceed?.()
              }}
            >
              Lämna sidan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
