import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import {
  Upload,
  Check,
  Loader2,
  FileText,
  File,
  Image,
  Download,
  Trash2,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useComponentImages } from '@/components/hooks/useComponentImages'
import type { ComponentInstance } from '@/services/types'

interface InstanceDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  instance: ComponentInstance
}

export const InstanceDetailsDialog = ({
  isOpen,
  onClose,
  instance,
}: InstanceDetailsDialogProps) => {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const [uploadValidationError, setUploadValidationError] = useState<
    string | null
  >(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{
    url: string
    originalName: string
    mimeType: string
  } | null>(null)

  const {
    images: documents,
    isLoading: docsLoading,
    error: docsError,
    upload,
    isUploading,
    uploadError,
    deleteImage,
    isDeleting,
  } = useComponentImages(instance.id)

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
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (dangerousExtensions.includes(extension)) {
      setUploadValidationError('Körbara filer är inte tillåtna')
      return
    }

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
          setUploadFile(null)
          setUploadValidationError(null)
        },
      }
    )
  }

  const handleDelete = (fileId: string) => {
    if (deleteConfirm === fileId) {
      deleteImage(fileId, {
        onSuccess: () => {
          setDeleteConfirm(null)
        },
      })
    } else {
      setDeleteConfirm(fileId)
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image
    if (mimeType.includes('pdf')) return FileText
    return File
  }

  const canPreview = (mimeType: string, fileName: string): boolean => {
    return (
      mimeType.includes('pdf') ||
      fileName.toLowerCase().endsWith('.pdf') ||
      mimeType.startsWith('image/')
    )
  }

  const getStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'ACTIVE':
        return 'default'
      case 'INACTIVE':
        return 'secondary'
      case 'MAINTENANCE':
        return 'outline'
      case 'DECOMMISSIONED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'Aktiv'
      case 'INACTIVE':
        return 'Inaktiv'
      case 'MAINTENANCE':
        return 'Underhåll'
      case 'DECOMMISSIONED':
        return 'Ur drift'
      default:
        return status
    }
  }

  const getConditionLabel = (condition: string | null | undefined): string => {
    switch (condition) {
      case 'NEW':
        return 'Nyskick'
      case 'GOOD':
        return 'Gott skick'
      case 'FAIR':
        return 'Godtagbart skick'
      case 'POOR':
        return 'Dåligt skick'
      case 'DAMAGED':
        return 'Skadat'
      default:
        return '-'
    }
  }

  const getConditionVariant = (
    condition: string | null | undefined
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (condition) {
      case 'NEW':
        return 'default'
      case 'GOOD':
        return 'default'
      case 'FAIR':
        return 'secondary'
      case 'POOR':
        return 'outline'
      case 'DAMAGED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Komponentdetaljer</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {instance.serialNumber}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="font-semibold mb-3">Grundinformation</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={getStatusVariant(instance.status)}>
                    {getStatusLabel(instance.status)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Skick</dt>
                <dd>
                  <Badge variant={getConditionVariant(instance.condition)}>
                    {getConditionLabel(instance.condition)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Serienummer</dt>
                <dd className="text-sm font-medium">{instance.serialNumber}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Antal</dt>
                <dd className="text-sm font-medium">{instance.quantity}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Inköpspris</dt>
                <dd className="text-sm font-medium">
                  {instance.priceAtPurchase} kr
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Avskrivningspris
                </dt>
                <dd className="text-sm font-medium">
                  {instance.depreciationPriceAtPurchase} kr
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Garantistart</dt>
                <dd className="text-sm font-medium">
                  {formatDate(instance.warrantyStartDate)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Garanti (månader)
                </dt>
                <dd className="text-sm font-medium">
                  {instance.warrantyMonths} mån
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Ekonomisk livslängd
                </dt>
                <dd className="text-sm font-medium">
                  {instance.economicLifespan} år
                </dd>
              </div>
              {instance.ncsCode && (
                <div>
                  <dt className="text-sm text-muted-foreground">NCS-kod</dt>
                  <dd className="text-sm font-medium">{instance.ncsCode}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Installation History */}
          <div>
            <h3 className="font-semibold mb-3">Installationshistorik</h3>
            {instance.componentInstallations &&
            instance.componentInstallations.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Installationsdatum</TableHead>
                      <TableHead>Avinstallationsdatum</TableHead>
                      <TableHead>Rum</TableHead>
                      <TableHead>Kostnad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instance.componentInstallations.map((install) => (
                      <TableRow key={install.id}>
                        <TableCell>
                          {formatDate(install.installationDate)}
                        </TableCell>
                        <TableCell>
                          {install.deinstallationDate ? (
                            formatDate(install.deinstallationDate)
                          ) : (
                            <Badge variant="default">Aktiv</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {install.spaceId || 'N/A'}
                        </TableCell>
                        <TableCell>{install.cost || 0} kr</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                Inga installationer ännu
              </p>
            )}
          </div>

          {/* Documents Section */}
          <div>
            <h3 className="font-semibold mb-3">
              Dokument{' '}
              {documents && documents.length > 0 && `(${documents.length})`}
            </h3>

            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : docsError ? (
              <p className="text-sm text-red-600 py-4 text-center border rounded-md">
                Kunde inte ladda dokument
              </p>
            ) : (
              <div className="space-y-3">
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
                    document.getElementById('instance-file-input')?.click()
                  }
                >
                  <input
                    id="instance-file-input"
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
                  <p className="text-sm text-red-600">
                    {uploadValidationError}
                  </p>
                )}

                {uploadError && (
                  <p className="text-sm text-red-600">
                    Uppladdning misslyckades. Försök igen.
                  </p>
                )}

                {/* Document list */}
                {documents && documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const FileIcon = getFileIcon(doc.mimeType)
                      const showPreview = canPreview(
                        doc.mimeType,
                        doc.originalName
                      )
                      return (
                        <div
                          key={doc.fileId}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border',
                            showPreview &&
                              'cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-shadow'
                          )}
                          onClick={() => showPreview && setPreviewDoc(doc)}
                        >
                          <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {doc.originalName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(doc.size)} •{' '}
                              {formatDate(doc.createdAt)}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {showPreview && (
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
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                    Inga dokument ännu
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Document Preview Modal */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{previewDoc.originalName}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-hidden">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.originalName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-full border-0"
                  title={`Preview of ${previewDoc.originalName}`}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => window.open(previewDoc.url, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Ladda ner
              </Button>
              <Button onClick={() => setPreviewDoc(null)}>Stäng</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
