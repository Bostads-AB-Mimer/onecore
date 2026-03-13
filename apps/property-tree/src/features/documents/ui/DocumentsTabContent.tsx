import { Download, FileText, Trash2, Upload } from 'lucide-react'

import { formatFileSize, useDocuments } from '@/entities/document'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { useToast } from '@/shared/hooks/useToast'
import { ContextType } from '@/shared/types/ui'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

interface DocumentsTabContentProps {
  contextType: ContextType
  id: string | undefined
}

export const DocumentsTabContent = ({
  contextType,
  id,
}: DocumentsTabContentProps) => {
  const {
    documents,
    isLoading,
    uploadFile,
    isUploading,
    deleteFile,
    isDeleting,
    getDownloadUrl,
  } = useDocuments(contextType, id)

  const { toast } = useToast()
  const isMobile = useIsMobile()

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      uploadFile(file, {
        onSuccess: () => {
          toast({
            title: 'Dokument uppladdat',
            description: `${file.name} har laddats upp framgångsrikt.`,
          })
          // Clear input
          event.target.value = ''
        },
        onError: (error) => {
          toast({
            title: 'Uppladdning misslyckades',
            description:
              error instanceof Error ? error.message : 'Ett fel uppstod',
            variant: 'destructive',
          })
        },
      })
    } catch (error) {
      toast({
        title: 'Uppladdning misslyckades',
        description: error instanceof Error ? error.message : 'Ett fel uppstod',
        variant: 'destructive',
      })
    }
  }

  const handleDownload = async (documentName: string) => {
    try {
      const url = await getDownloadUrl(documentName)

      // Open the presigned URL in a new tab
      window.open(url, '_blank')

      toast({
        title: 'Laddar ner',
        description: `${documentName} öppnas...`,
      })
    } catch (error) {
      toast({
        title: 'Nedladdning misslyckades',
        description: error instanceof Error ? error.message : 'Ett fel uppstod',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = (documentName: string) => {
    deleteFile(documentName, {
      onSuccess: () => {
        toast({
          title: 'Dokument borttaget',
          description: 'Dokumentet har tagits bort.',
          variant: 'destructive',
        })
      },
      onError: (error) => {
        toast({
          title: 'Borttagning misslyckades',
          description:
            error instanceof Error ? error.message : 'Ett fel uppstod',
          variant: 'destructive',
        })
      },
    })
  }

  return (
    <TabLayout
      title="Dokument"
      count={isLoading ? undefined : documents.length}
      showCard={true}
      isLoading={isLoading}
    >
      {/* Upload sektion */}
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
        <div className="text-center space-y-4">
          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
          <div>
            <Label htmlFor="document-file-upload" className="cursor-pointer">
              <Button variant="outline" disabled={isUploading || !id} asChild>
                <span>
                  {isUploading ? 'Laddar upp...' : 'Välj fil att ladda upp'}
                </span>
              </Button>
            </Label>
            <Input
              id="document-file-upload"
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.jpg,.jpeg,.png"
              disabled={isUploading || !id}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Stöder PDF, Word, Excel, DWG, och bildformaten. Max 10 MB.
          </p>
        </div>
      </div>

      {/* Dokumentlista */}
      <div className="space-y-3">
        {documents.map((document) => (
          <Card key={document.id} className="p-4">
            {isMobile ? (
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-base mb-2">
                    {document.name}
                  </h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatFileSize(document.size)}</span>
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {document.type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(document.name)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(document.name)}
                    disabled={isDeleting}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {document.name}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>{formatFileSize(document.size)}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                        {document.type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(document.name)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(document.name)}
                    disabled={isDeleting}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {documents.length === 0 && (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-muted-foreground">Inga dokument uppladdade än</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ladda upp ditt första dokument för att komma igång
          </p>
        </div>
      )}
    </TabLayout>
  )
}
