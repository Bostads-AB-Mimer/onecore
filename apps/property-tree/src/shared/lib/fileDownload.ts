/** Saves a blob (e.g. an Excel export) as a file in the browser. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => {
    URL.revokeObjectURL(url)
    link.remove()
  }, 1000)
}

/**
 * Downloads a file from a base64-encoded string
 * @param base64Data - The base64-encoded file data
 * @param filename - The name to save the file as
 * @param mimeType - The MIME type of the file (default: 'application/pdf')
 */
export function downloadFileFromBase64(
  base64Data: string,
  filename: string,
  mimeType: string = 'application/pdf'
): void {
  // Convert base64 to blob
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  downloadBlob(new Blob([byteArray], { type: mimeType }), filename)
}
