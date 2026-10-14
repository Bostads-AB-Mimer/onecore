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
  const blob = new Blob([byteArray], { type: mimeType })

  // Create download link
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
