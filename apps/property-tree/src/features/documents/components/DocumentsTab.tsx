import { TabLayout } from '@/components/ui/TabLayout'
import { Card } from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/v2/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/v2/Label'
import { FileText, Upload, Download, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useIsMobile } from '@/hooks/useMobile'
import { ContextType } from '@/types/ui'
import { useDocuments } from '../hooks/useDocuments'
import { formatFileSize } from '../lib/file-utils'

interface DocumentsTabProps {
  contextType: ContextType
  id: string | undefined
}

export const DocumentsTab = ({ contextType, id }: DocumentsTabProps) => {
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

  if (isLoading) {
    return (
      <TabLayout title="Dokument" count={0} showCard={true}>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Laddar dokument...</p>
        </div>
      </TabLayout>
    )
  }

  console.log(documents)

  return (
    <TabLayout title="Dokument" count={documents.length} showCard={true}>
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

      {documents.length === 0 && !isLoading && (
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
