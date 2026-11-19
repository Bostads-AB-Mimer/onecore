import { useMutation } from '@tanstack/react-query'

import { downloadBlob } from '@/shared/lib/fileDownload'

import { useToast } from './useToast'

/** Downloads an Excel export as `<filePrefix>-<today>.xlsx`, or shows a
 * toast when it fails. */
export function useExcelExport(
  exportFn: () => Promise<Blob>,
  filePrefix: string
) {
  const { toast } = useToast()

  return useMutation({
    mutationFn: exportFn,
    onSuccess: (blob) =>
      downloadBlob(
        blob,
        // sv-SE gives the local day as yyyy-mm-dd.
        `${filePrefix}-${new Date().toLocaleDateString('sv-SE')}.xlsx`
      ),
    onError: () =>
      toast({
        title: 'Exporten misslyckades',
        description: 'Excel-filen kunde inte skapas. Försök igen om en stund.',
        variant: 'destructive',
      }),
  })
}
