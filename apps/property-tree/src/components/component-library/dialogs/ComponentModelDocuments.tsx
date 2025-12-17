import { useState } from 'react'
import {
  Upload,
  Check,
  Loader2,
  FileText,
  File,
  Table,
  Image,
  Download,
  Trash2,
  Eye,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/v2/Button'
import { cn } from '@/lib/utils'
import { useComponentModelDocuments } from '@/components/hooks/useComponentModelDocuments'

interface ComponentModelDocumentsProps {
  modelId: string
  isOpen: boolean
  onClose: () => void
}

export function ComponentModelDocuments({
  modelId,
  isOpen,
  onClose,
}: ComponentModelDocumentsProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const [uploadValidationError, setUploadValidationError] = useState<
    string | null
  >(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<(typeof documents)[0] | null>(
    null
  )

  const {
    documents,
    isLoading,
    error,
    upload,
    isUploading,
    uploadError,
    deleteDocument,
    isDeleting,
  } = useComponentModelDocuments(modelId)

  const dangerousExtensions = [
    '.exe',
    '.dll',
    '.bat',
    '.sh',
    '.app',
    '.msi',
    '.cmd',
    '.scr',
  ]

  const validateAndSetUploadFile = (file: File) => {
    setUploadValidationError(null)

    // Check for PDF file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    const isPdfFile = extension === '.pdf' || file.type === 'application/pdf'

    if (!isPdfFile) {
      setUploadValidationError(
        'Endast PDF-filer är tillåtna. Konvertera Word- eller Excel-dokument till PDF innan uppladdning.'
      )
      return
    }

    // Check for dangerous file types
    if (dangerousExtensions.includes(extension)) {
      setUploadValidationError('Körbara filer är inte tillåtna')
      return
    }

    // Check file size (50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadValidationError('Filen är för stor. Max storlek är 50MB')
      return
    }

    setUploadFile(file)
  }

  const handleUploadDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDragActive(true)
  }

  const handleUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDragActive(false)
  }

  const handleUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 1) {
      setUploadValidationError('Vänligen ladda upp en fil åt gången')
      return
    }

    validateAndSetUploadFile(files[0])
  }

  const handleUploadFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetUploadFile(selectedFile)
    }
  }

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      setUploadValidationError('Välj en fil')
      return
    }

    upload(
      { file: uploadFile },
      {
        onSuccess: () => {
          // Reset form
          setUploadFile(null)
          setUploadValidationError(null)
        },
      }
    )
  }

  const handleDelete = (fileId: string) => {
    if (deleteConfirm === fileId) {
      // Actually delete
      deleteDocument(fileId, {
        onSuccess: () => {
          setDeleteConfirm(null)
        },
      })
    } else {
      // Show confirmation
      setDeleteConfirm(fileId)
      // Auto-cancel confirmation after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image
    if (mimeType.includes('pdf')) return FileText
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return Table
    return File
  }

  // Helper to determine if file is a PDF (only PDFs are previewable)
  const isPdf = (doc: (typeof documents)[0]): boolean => {
    if (!doc) return false
    const mimeType = doc.mimeType.toLowerCase()
    const fileName = doc.originalName.toLowerCase()
    return mimeType.includes('pdf') || fileName.endsWith('.pdf')
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dokumentation</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">
              Laddar dokument...
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Error state
  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dokumentation</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-red-600">
              Kunde inte ladda dokument. Försök igen.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Empty state - inline upload
  if (!documents || documents.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dokumentation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag-drop zone */}
            <div
              onDrop={handleUploadDrop}
              onDragOver={handleUploadDragOver}
              onDragEnter={handleUploadDragEnter}
              onDragLeave={handleUploadDragLeave}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                uploadDragActive && 'border-primary bg-primary/5',
                !uploadDragActive &&
                  !uploadFile &&
                  'border-gray-300 hover:border-gray-400',
                uploadFile && 'bg-green-50 border-green-300'
              )}
              onClick={() =>
                document.getElementById('empty-file-input')?.click()
              }
            >
              <input
                id="empty-file-input"
                type="file"
                className="hidden"
                onChange={handleUploadFileInputChange}
              />

              {uploadFile ? (
                <div>
                  <Check className="h-12 w-12 mx-auto text-green-600 mb-2" />
                  <p className="font-medium">{uploadFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(uploadFile.size)}
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p className="font-medium">
                    Dra fil hit eller klicka för att bläddra
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Endast PDF-filer • Max 50MB
                  </p>
                </div>
              )}
            </div>

            {uploadValidationError && (
              <p className="text-sm text-red-600">{uploadValidationError}</p>
            )}

            {uploadError && (
              <p className="text-sm text-red-600">
                Uppladdning misslyckades. Försök igen.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isUploading}>
              Avbryt
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={isUploading || !uploadFile}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Laddar upp...
                </>
              ) : (
                'Ladda upp'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Document list view
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Dokumentation ({documents.length})</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Upload zone */}
            <div
              onDrop={handleUploadDrop}
              onDragOver={handleUploadDragOver}
              onDragEnter={handleUploadDragEnter}
              onDragLeave={handleUploadDragLeave}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                uploadDragActive && 'border-primary bg-primary/5',
                !uploadDragActive &&
                  !uploadFile &&
                  'border-gray-300 hover:border-gray-400',
                uploadFile && 'bg-green-50 border-green-300'
              )}
              onClick={() =>
                document.getElementById('list-file-input')?.click()
              }
            >
              <input
                id="list-file-input"
                type="file"
                className="hidden"
                onChange={handleUploadFileInputChange}
              />

              {uploadFile ? (
                <div className="flex items-center justify-center gap-4">
                  <Check className="h-6 w-6 text-green-600" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(uploadFile.size)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUploadSubmit()
                    }}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Laddar upp...
                      </>
                    ) : (
                      'Ladda upp'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span>Dra fil hit eller klicka för att ladda upp</span>
                </div>
              )}
            </div>

            {uploadValidationError && (
              <p className="text-sm text-red-600">{uploadValidationError}</p>
            )}

            {uploadError && (
              <p className="text-sm text-red-600">
                Uppladdning misslyckades. Försök igen.
              </p>
            )}

            {/* Document list */}
            <div className="space-y-2">
              {documents.map((doc) => {
                const FileIcon = getFileIcon(doc.mimeType)
                const canPreview = isPdf(doc)
                return (
                  <div
                    key={doc.fileId}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      canPreview &&
                        'cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-shadow'
                    )}
                    onClick={() => canPreview && setPreviewDoc(doc)}
                  >
                    <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.originalName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(doc.size)} • {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {canPreview && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreviewDoc(doc)
                          }}
                          title="Förhandsgranska"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(doc.url, '_blank')
                        }}
                        title="Ladda ner"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={
                          deleteConfirm === doc.fileId
                            ? 'destructive'
                            : 'outline'
                        }
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(doc.fileId)
                        }}
                        disabled={isDeleting}
                        title="Ta bort"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleteConfirm === doc.fileId && (
                          <span className="ml-1 text-xs">Bekräfta?</span>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{previewDoc.originalName}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewDoc.url}
                className="w-full h-full border-0"
                title={`Preview of ${previewDoc.originalName}`}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => window.open(previewDoc.url, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Ladda ner
              </Button>
              <Button onClick={() => setPreviewDoc(null)}>Stäng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
