import * as React from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import { useFeedbackModal } from '@/shared/hooks/useFeedbackModal'
import { useCreateFeedback } from '@/entities/tenant/hooks/useCreateFeedback'
import { useToast } from '@/shared/hooks/useToast'

const LABEL_IDS = {
  bug: '1e656430-7ee7-4104-9e6d-7b1e0c60c343',
  feature: '7f294727-2fa3-4e2f-bf4c-a585d32eb94e',
  improvement: '48f9f0f2-6dac-46fb-be82-c4ed49dd4da4',
} as const

type FeedbackType = keyof typeof LABEL_IDS

interface FormData {
  title: string
  type: FeedbackType | ''
  importance: number
  whoIsAffected: string
  currentSituation: string
  need: string
  value: string
}

const resizeAndConvertToBase64 = (
  file: File,
  maxSize = 800,
  quality = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize
          width = maxSize
        } else {
          width = (width / height) * maxSize
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function FeedbackModal() {
  const { isOpen, close } = useFeedbackModal()
  const { mutateAsync: createFeedback, isPending } = useCreateFeedback()
  const { toast } = useToast()

  const [formData, setFormData] = React.useState<FormData>({
    title: '',
    type: '',
    importance: 5,
    whoIsAffected: '',
    currentSituation: '',
    need: '',
    value: '',
  })
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)

  const resetForm = () => {
    setFormData({
      title: '',
      type: '',
      importance: 5,
      whoIsAffected: '',
      currentSituation: '',
      need: '',
      value: '',
    })
    setImageFile(null)
    setImagePreview(null)
  }

  const handleClose = () => {
    resetForm()
    close()
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const preview = await resizeAndConvertToBase64(file)
      setImagePreview(preview)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.type || !formData.need) {
      toast({
        title: 'Fyll i alla fält',
        description: 'Titel, typ och behov krävs',
        variant: 'destructive',
      })
      return
    }

    try {
      const descriptionParts = [
        `**Viktighet:** ${formData.importance}/10`,
        formData.whoIsAffected && `**Vem påverkas:** ${formData.whoIsAffected}`,
        formData.currentSituation &&
          `**Nuvarande situation:** ${formData.currentSituation}`,
        `**Behov:** ${formData.need}`,
        formData.value && `**Värde:** ${formData.value}`,
      ].filter(Boolean)

      let description = descriptionParts.join('\n\n')

      if (imageFile && imagePreview) {
        description += `\n\n![screenshot](${imagePreview})`
      }

      await createFeedback({
        title: formData.title,
        description,
        categoryLabelId: LABEL_IDS[formData.type],
      })

      toast({
        title: 'Feedback skickad',
        description: 'Tack för din feedback!',
      })

      handleClose()
    } catch {
      toast({
        title: 'Något gick fel',
        description: 'Kunde inte skicka feedback, försök igen',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => !open && handleClose()}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto top-[10%] translate-y-0">
        <DialogHeader>
          <DialogTitle>Feedback ONECore</DialogTitle>
          <DialogDescription>
            Har du en idé, saknar något eller har upptäckt något som kan bli
            bättre? Hör gärna av dig till oss så hjälps vi åt att utveckla
            onecore till det bättre.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-4">
            <h3 className="font-semibold">Skapa Ärende</h3>

            {/* Title */}
            <div className="space-y-2">
              <Input
                placeholder="Namn på ärende"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Select
                value={formData.type}
                onValueChange={(value: FeedbackType) =>
                  setFormData((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature">Ny funktion</SelectItem>
                  <SelectItem value="improvement">Förbättring</SelectItem>
                </SelectContent>
              </Select>
              {formData.type === 'bug' && (
                <p className="text-sm text-destructive">
                  Kritiska buggar ska alltid rapporteras direkt i Topdesk.
                  Ärenden som kommer in här behandlas och prioriteras i den
                  löpande utvecklingen och förbättringsarbetet.
                </p>
              )}
            </div>

            {/* Importance */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Hur viktigt är det för dig i ditt dagliga arbete?</Label>
                <span className="inline-flex items-center justify-center min-w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                  {formData.importance}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.importance}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    importance: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mindre viktigt</span>
                <span>Behövs för dagligt arbete</span>
              </div>
            </div>

            {/* Who is affected */}
            <div className="space-y-2">
              <Label htmlFor="whoIsAffected">Vem påverkas?</Label>
              <Input
                id="whoIsAffected"
                placeholder="T.ex. kundtjänst, förvaltare, hyresgäster..."
                value={formData.whoIsAffected}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    whoIsAffected: e.target.value,
                  }))
                }
              />
            </div>

            {/* Current situation */}
            <div className="space-y-2">
              <Label htmlFor="currentSituation">Nuvarande situation</Label>
              <Textarea
                id="currentSituation"
                placeholder="Beskriv hur det fungerar idag och vad som är problematiskt..."
                value={formData.currentSituation}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    currentSituation: e.target.value,
                  }))
                }
                className="min-h-[80px]"
              />
            </div>

            {/* Need */}
            <div className="space-y-2">
              <Label htmlFor="need">
                Behov <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="need"
                placeholder="Vad behöver du kunna göra? Beskriv målet, inte lösningen..."
                value={formData.need}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    need: e.target.value,
                  }))
                }
                className="min-h-[80px]"
                required
              />
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="value">Värde</Label>
              <Input
                id="value"
                placeholder="Vad blir effekten om behovet uppfylls? T.ex. sparar tid, minskar fel..."
                value={formData.value}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    value: e.target.value,
                  }))
                }
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-32 rounded border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-md cursor-pointer hover:bg-accent transition-colors w-fit">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">LADDA UPP BILD</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Skickar...
              </>
            ) : (
              'Skapa ärende'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
