import type { ReceiptData } from '@/services/types'

import {
  generateLoanReceiptBlob,
  generateReturnReceiptBlob,
} from './pdf-receipts'

/**
 * Opens a PDF receipt in a new browser tab with automatic print dialog
 * This function avoids popup blockers by opening the tab synchronously,
 * then generating and loading the PDF asynchronously
 *
 * @param receiptData - The receipt data to generate the PDF from
 * @param receiptId - Optional receipt ID to include in the PDF
 */
export async function openPdfInNewTab(
  receiptData: ReceiptData,
  receiptId?: string
): Promise<void> {
  // Open a placeholder tab synchronously to avoid popup blockers
  const win = window.open('', '_blank')
  if (!win) {
    console.error('Popup blocked - could not open PDF')
    return
  }

  // Show loading message while PDF is being generated
  win.document.write(
    '<!doctype html><title>Kvitto</title><body>Förbereder kvitto…</body>'
  )
  win.document.close()

  // Generate the PDF blob based on receipt type
  const { blob, fileName } =
    receiptData.receiptType === 'LOAN'
      ? await generateLoanReceiptBlob(receiptData, receiptId)
      : await generateReturnReceiptBlob(receiptData, receiptId)

  const pdfUrl = URL.createObjectURL(blob)

  // Create an HTML viewer that embeds the PDF and triggers print dialog
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
    // Try printing shortly after load; some viewers need a delay
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

  // Navigate the already-open tab to the viewer
  win.location.href = viewerUrl

  // Cleanup after 5 minutes (tab holds the URLs while open)
  setTimeout(
    () => {
      URL.revokeObjectURL(pdfUrl)
      URL.revokeObjectURL(viewerUrl)
    },
    5 * 60 * 1000
  )
}
