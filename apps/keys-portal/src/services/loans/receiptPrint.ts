/**
 * Receipt rendering + printing — the bridge between assembled `ReceiptData` and the
 * PDF layer. Builds return blobs (for storage/merge) and opens a receipt in a print
 * tab. The only place that calls `pdf-receipts`.
 */
import {
  generateLoanReceiptBlob,
  generateReturnReceiptBlob,
} from '@/lib/pdf-receipts'

import type { ReceiptData } from '../types'
import {
  assembleReturnReceiptData,
  type ReturnReceiptInput,
} from './receiptData'

/** Renders a receipt to a PDF blob (loan or return), branching on its type. */
export async function renderReceiptBlob(
  data: ReceiptData
): Promise<{ blob: Blob; fileName: string }> {
  return data.receiptType === 'RETURN'
    ? generateReturnReceiptBlob(data)
    : generateLoanReceiptBlob(data)
}

/** Assembles + renders a return-receipt blob (without uploading) for one loan. */
export async function buildReturnReceiptBlob(
  input: ReturnReceiptInput
): Promise<{ blob: Blob; fileName: string }> {
  const data = await assembleReturnReceiptData(input)
  return generateReturnReceiptBlob(data)
}

/** Opens an already-assembled receipt in a new tab and triggers the print dialog. */
export async function printReceipt(data: ReceiptData): Promise<void> {
  const { blob, fileName } = await renderReceiptBlob(data)
  openPdfBlobInNewTab(blob, fileName)
}

/**
 * Opens a PDF blob in a new browser tab with an auto-print dialog. Handles popup
 * blocking and URL cleanup. Browser-only side effect; not unit-tested.
 */
export function openPdfBlobInNewTab(blob: Blob, fileName: string): void {
  const win = window.open('', '_blank')
  if (!win) {
    console.error('Popup blocked - could not open PDF')
    return
  }

  win.document.write(
    '<!doctype html><title>Kvittens</title><body>Förbereder kvittens…</body>'
  )
  win.document.close()

  const pdfUrl = URL.createObjectURL(blob)
  const viewerHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>html,body,iframe{margin:0;padding:0;height:100%;width:100%;border:0}</style>
</head>
<body>
  <iframe id="pdf" src="${pdfUrl}#view=FitH" allow="clipboard-write"></iframe>
  <script>
    const iframe = document.getElementById('pdf');
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try {
          iframe.contentWindow && iframe.contentWindow.print && iframe.contentWindow.print();
        } catch (e) {
          console.error('Failed to trigger print:', e);
        }
      }, 400);
    });
  </script>
</body>
</html>`

  const viewerBlob = new Blob([viewerHtml], { type: 'text/html' })
  const viewerUrl = URL.createObjectURL(viewerBlob)
  win.location.href = viewerUrl

  setTimeout(
    () => {
      URL.revokeObjectURL(pdfUrl)
      URL.revokeObjectURL(viewerUrl)
    },
    5 * 60 * 1000
  )
}
