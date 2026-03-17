import { FileText, Paperclip, X } from 'lucide-react'
import { XledgerProject } from '@onecore/types'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'

interface AdditionalInfoSectionProps {
  selectedProject: XledgerProject | null
  projects?: XledgerProject[]
  isLoadingProjects?: boolean
  comment: string
  onProjectChange: (project: XledgerProject | null) => void
  onCommentChange: (value: string) => void
  onFileAttached: (file: File | null) => void
  attachedFile?: File | null
}

export function AdditionalInfoSection({
  selectedProject,
  projects,
  isLoadingProjects,
  comment,
  onProjectChange,
  onCommentChange,
  onFileAttached,
  attachedFile,
}: AdditionalInfoSectionProps) {
  const handleProjectSelect = (projectCode: string) => {
    if (projectCode === 'none') {
      onProjectChange(null)
    } else {
      const project = projects?.find((p) => p.code === projectCode)
      onProjectChange(project || null)
    }
  }

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
        <Label>Projekt</Label>
        {isLoadingProjects ? (
          <div>Laddar projekt...</div>
        ) : (
          <Select
            value={selectedProject?.code || 'none'}
            onValueChange={handleProjectSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Välj projekt (valfritt)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Inget projekt</SelectItem>
              {projects
                ?.filter((p) => p.code)
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((project) => (
                  <SelectItem key={project.code} value={project.code}>
                    {project.code} - {project.description}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
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
