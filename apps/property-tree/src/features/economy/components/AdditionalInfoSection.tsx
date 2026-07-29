import { useState } from 'react'
import { XledgerProject } from '@onecore/types'
import { FileText, Paperclip, X } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'

import { isMergeableFileType } from '../lib/mergeFilesToPdf'

interface AdditionalInfoSectionProps {
  selectedProject: XledgerProject | null
  projects?: XledgerProject[]
  isLoadingProjects?: boolean
  comment: string
  onProjectChange: (project: XledgerProject | null) => void
  onCommentChange: (value: string) => void
  onFilesChanged: (files: File[]) => void
  attachedFiles: File[]
}

const fileKey = (file: File) => `${file.name}:${file.size}`

export function AdditionalInfoSection({
  selectedProject,
  projects,
  isLoadingProjects,
  comment,
  onProjectChange,
  onCommentChange,
  onFilesChanged,
  attachedFiles,
}: AdditionalInfoSectionProps) {
  const [fileError, setFileError] = useState<string | null>(null)

  const handleProjectSelect = (projectCode: string) => {
    if (projectCode === 'none') {
      onProjectChange(null)
    } else {
      const project = projects?.find((p) => p.code === projectCode)
      onProjectChange(project || null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = e.target.files ? Array.from(e.target.files) : []
    // Reset so the same file can be picked again after removal
    e.target.value = ''

    if (pickedFiles.length === 0) {
      return
    }

    // A single attachment of any type is uploaded as-is (like before), but
    // multiple attachments are merged into one PDF and must all be
    // PDF/JPG/PNG. So the list is either one file of any type, or several
    // mergeable files.
    if (attachedFiles.length === 0 && pickedFiles.length === 1) {
      setFileError(null)
      onFilesChanged(pickedFiles)
      return
    }

    const nonMergeableAttached = attachedFiles.find(
      (file) => !isMergeableFileType(file)
    )
    if (nonMergeableAttached) {
      setFileError(
        `Fler filer kan inte läggas till eftersom "${nonMergeableAttached.name}" inte är en PDF-, JPG- eller PNG-fil. Ta bort den först.`
      )
      return
    }

    const unsupportedFiles = pickedFiles.filter(
      (file) => !isMergeableFileType(file)
    )
    const supportedFiles = pickedFiles.filter(isMergeableFileType)

    const existingKeys = new Set(attachedFiles.map(fileKey))
    const newFiles = supportedFiles.filter(
      (file) => !existingKeys.has(fileKey(file))
    )

    setFileError(
      unsupportedFiles.length > 0
        ? `Endast PDF-, JPG- och PNG-filer kan kombineras. Följande filer lades inte till: ${unsupportedFiles
            .map((file) => file.name)
            .join(', ')}`
        : null
    )

    if (newFiles.length > 0) {
      onFilesChanged([...attachedFiles, ...newFiles])
    }
  }

  const removeFile = (file: File) => {
    setFileError(null)
    onFilesChanged(
      attachedFiles.filter((attached) => fileKey(attached) !== fileKey(file))
    )
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
        <Label>Bifogade filer</Label>
        <div className="space-y-2">
          {attachedFiles.map((file) => (
            <div
              key={fileKey(file)}
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
                onClick={() => removeFile(file)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {attachedFiles.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Filerna slås ihop till en PDF när underlaget skickas.
            </p>
          )}
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          <div>
            <input
              type="file"
              id="file-upload"
              className="sr-only"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
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
                  Bifoga filer
                </span>
              </Button>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
