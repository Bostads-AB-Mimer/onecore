/**
 * Converts a File object to a base64-encoded string
 * @param file - The file to convert
 * @returns Promise that resolves to base64 string (without data URL prefix)
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      // Extract base64 data (remove "data:mime/type;base64," prefix)
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
  })
}
