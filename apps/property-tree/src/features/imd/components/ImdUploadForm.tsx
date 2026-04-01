import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Upload,
  X,
} from 'lucide-react'

import { imdService } from '@/services/api/core'

import { useToast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Separator } from '@/shared/ui/Separator'

function downloadCsv(content: string, filename: string) {
  const bom = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ImdUploadForm() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof imdService.processIMD>
  > | null>(null)

  const mutation = useMutation({
    mutationFn: async (csv: string) => imdService.processIMD(csv),
    onSuccess: (data) => {
      setResult(data)
      toast({
        title: 'Bearbetning klar',
        description: `${data.numEnriched} rader berikade, ${data.numUnprocessed} ej bearbetade.`,
      })
    },
    onError: () => {
      toast({
        title: 'Bearbetning misslyckades',
        description:
          'Kunde inte bearbeta filen. Kontrollera formatet och försök igen.',
        variant: 'destructive',
      })
    },
  })

  const acceptFile = (file: File) => {
    setSelectedFile(file)
    setResult(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    acceptFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Ogiltigt filformat',
        description: 'Endast CSV-filer stöds.',
        variant: 'destructive',
      })
      return
    }

    acceptFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    if (!selectedFile) return
    const csv = await selectedFile.text()
    mutation.mutate(csv)
  }

  const handleDownloadEnriched = () => {
    if (!result) return
    const baseName = selectedFile?.name?.replace(/\.csv$/i, '') ?? 'imd'
    downloadCsv(result.enrichedCsv, `${baseName}-tenfast.csv`)
  }

  const handleDownloadUnprocessed = () => {
    if (!result) return
    const baseName = selectedFile?.name?.replace(/\.csv$/i, '') ?? 'imd'
    downloadCsv(result.unprocessedCsv, `${baseName}-ej-bearbetade.csv`)
  }

  const numEnriched = result?.numEnriched ?? 0
  const numUnprocessed = result?.numUnprocessed ?? 0

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="font-medium">Ladda upp CSV</h3>
          <p className="text-sm text-muted-foreground">
            Välj en IMD-fil för att berika med kontraktsuppgifter och generera
            Tenfast-underlag.
          </p>
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Krav på filen</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Rå IMD-exportfil, semikolonseparerad CSV</li>
              <li>Minst 11 kolumner per rad</li>
              <li>Inga kolumnrubriker — enbart datarader</li>
              <li>
                Alla rader måste tillhöra samma period (Fr.o.m och T.o.m) —
                blanda inte månader i samma fil
              </li>
            </ul>
            <p className="text-xs text-muted-foreground/70">
              Exempelrad:
              306-008-01-0201;2026-01-01;2026-01-31;VV;129,312;136,892;7,580;621,680;;82,016;m3;;;1
            </p>
          </div>

          {!selectedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-gray-200'
              )}
            >
              <div className="text-center space-y-4">
                <Upload
                  className={cn(
                    'h-8 w-8 mx-auto transition-colors',
                    isDragging ? 'text-primary' : 'text-gray-400'
                  )}
                />
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".csv"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Välj CSV-fil
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  eller dra och släpp en fil här
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedFile.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleRemoveFile}
                disabled={mutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {mutation.isPending ? (
            <div className="space-y-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Bearbetar... Stora filer kan ta upp till en minut.
              </p>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!selectedFile}>
                Bearbeta
              </Button>
            </div>
          )}
        </div>
      </Card>

      {result && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="font-medium">Resultat</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{result?.totalRows}</p>
                <p className="text-sm text-muted-foreground">Totalt rader</p>
              </div>
              <div
                className={cn(
                  'rounded-lg border p-4 text-center',
                  numEnriched > 0 && 'border-green-200 bg-green-50'
                )}
              >
                <p className="text-2xl font-bold text-green-700">
                  {numEnriched}
                </p>
                <p className="text-sm text-muted-foreground">Berikade</p>
              </div>
              <div
                className={cn(
                  'rounded-lg border p-4 text-center',
                  numUnprocessed > 0 && 'border-amber-200 bg-amber-50'
                )}
              >
                <p className="text-2xl font-bold text-amber-700">
                  {numUnprocessed}
                </p>
                <p className="text-sm text-muted-foreground">Ej bearbetade</p>
              </div>
            </div>

            <Separator />

            {numEnriched > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Tenfast-fil klar</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{numEnriched} rader redo för import i Tenfast.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadEnriched}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Ladda ner
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {numUnprocessed > 0 && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Ej bearbetade rader</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    {numUnprocessed} rader kunde inte bearbetas. Ladda ner för
                    detaljer.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadUnprocessed}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Ladda ner
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
