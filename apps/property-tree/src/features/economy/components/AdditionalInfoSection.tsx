import { FileText, Paperclip, X } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { Textarea } from '@/shared/ui/Textarea'

interface AdditionalInfoSectionProps {
  project: string
  comment: string
  onProjectChange: (value: string) => void
  onCommentChange: (value: string) => void
  onFileAttached: (file: File | null) => void
  attachedFile?: File | null
}

export function AdditionalInfoSection({
  project,
  comment,
  onProjectChange,
  onCommentChange,
  onFileAttached,
  attachedFile,
}: AdditionalInfoSectionProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      onFileAttached(file)
    }
    e.target.value = ''
  }

  const removeFile = () => {
    onFileAttached(null)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project">Projekt</Label>
        <Input
          id="project"
          value={project}
          onChange={(e) => onProjectChange(e.target.value)}
          placeholder="Projektnummer (valfritt)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment">Intern info</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Intern information som inte syns på fakturan..."
          maxLength={255}
          rows={2}
        />
        <p className="text-xs text-muted-foreground text-right">
          {comment.length}/255 tecken
        </p>
      </div>

      <div className="space-y-2">
        <Label>Bifogad fil</Label>
        <div className="space-y-2">
          {attachedFile && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{attachedFile.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={removeFile}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div>
            <input
              type="file"
              id="file-upload"
              className="sr-only"
              onChange={handleFileChange}
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
