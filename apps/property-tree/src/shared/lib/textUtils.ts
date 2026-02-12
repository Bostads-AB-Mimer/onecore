/**
 * Capitalizes the first letter and lowercases the rest
 * Example: "BELLMANSGATAN 1A" -> "Bellmansgatan 1a"
 */
export function toTitleCase(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}
