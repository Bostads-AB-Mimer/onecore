/**
 * Capitalizes the first letter of each word
 * Example: "BELLMANSGATAN 1A" -> "Bellmansgatan 1a"
 * Example: "FÖRRÅD ALLMOGEPLATSEN" -> "Förråd Allmogeplatsen"
 */
export function toTitleCase(text: string): string {
  if (!text) return text
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
