import { useState } from 'react'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Paperclip, X, FileText } from 'lucide-react'

interface AdditionalInfoSectionProps {
  projekt: string
  internInfo: string
  onProjektChange: (value: string) => void
  onInternInfoChange: (value: string) => void
}

export function AdditionalInfoSection({
  projekt,
  internInfo,
  onProjektChange,
  onInternInfoChange,
}: AdditionalInfoSectionProps) {
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setAttachedFiles((prev) => [...prev, ...newFiles])
    }
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="projekt">Projekt</Label>
        <Input
          id="projekt"
          value={projekt}
          onChange={(e) => onProjektChange(e.target.value)}
          placeholder="Projektnummer (valfritt)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internInfo">Intern info</Label>
        <Textarea
          id="internInfo"
          value={internInfo}
          onChange={(e) => onInternInfoChange(e.target.value)}
          placeholder="Intern information som inte syns på fakturan..."
          maxLength={255}
          rows={2}
        />
        <p className="text-xs text-muted-foreground text-right">
          {internInfo.length}/255 tecken
        </p>
      </div>

      <div className="space-y-2">
        <Label>Bifogade filer</Label>
        <div className="space-y-2">
          {attachedFiles.length > 0 && (
            <ul className="space-y-1">
              {attachedFiles.map((file, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <input
              type="file"
              id="file-upload"
              className="sr-only"
              onChange={handleFileChange}
              multiple
            />
            <label htmlFor="file-upload">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                asChild
              >
                <span>
                  <Paperclip className="h-4 w-4 mr-2" />
                  Bifoga fil
                </span>
              </Button>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
