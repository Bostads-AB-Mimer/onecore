import * as React from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useFeedbackModal } from '@/components/hooks/useFeedbackModal'
import { useCreateFeedback } from '@/hooks/useCreateFeedback'
import { useToast } from '@/components/hooks/useToast'

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
  description: string
}

const DESCRIPTION_PLACEHOLDER = `Beskriv kort:
Vad du vill kunna göra:
Vad du saknar eller tycker är krångligt:
Hur du skulle vilja att det fungerade:
Vilka påverkas:`

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
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
    description: '',
  })
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)

  const resetForm = () => {
    setFormData({ title: '', type: '', importance: 5, description: '' })
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
      const preview = await fileToBase64(file)
      setImagePreview(preview)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.type || !formData.description) {
      toast({
        title: 'Fyll i alla fält',
        description: 'Titel, typ och beskrivning krävs',
        variant: 'destructive',
      })
      return
    }

    try {
      let description = `Viktighet: ${formData.importance}/10\n\n${formData.description}`

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feedback ONECore</DialogTitle>
          <DialogDescription>
            Har du en idé, saknar något eller har upptäckt något som kan bli
            bättre? Hör gärna av dig till oss så hjälps vi åt att utveckla
            onecore till det bättre.
          </DialogDescription>
          <p className="text-sm text-muted-foreground mt-2">
            Det går också bra att rapportera in icke-akuta buggar här så
            planerar vi in dem i vårt arbete. <strong>Akuta buggar</strong>{' '}
            rapporteras direkt i <strong>topdesk</strong>.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
            </div>

            {/* Importance */}
            <div className="space-y-2">
              <Label>Hur viktigt är det för dig i ditt dagliga arbete?</Label>
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
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-orange-500">
                  *1 inte alls viktigt men vore kul
                </span>
                <span className="font-medium">{formData.importance}</span>
                <span className="text-orange-500">
                  10 behöver detta för att kunna utföra mitt dagliga arbete
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Textarea
                placeholder={DESCRIPTION_PLACEHOLDER}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="min-h-[150px]"
                required
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
