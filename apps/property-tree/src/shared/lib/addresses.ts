function splitAddress(address: string): { name: string; number: number } {
  const m = address.match(/^(.*?)(\d+)/)
  if (!m) return { name: address.trim(), number: 0 }
  return { name: m[1].trim(), number: parseInt(m[2], 10) }
}

// Natural sort for Swedish "<street> <number>" strings: street alphabetically
// via sv-locale, then numeric house number. Dedupes input.
export function sortStreetAddresses(addresses: string[]): string[] {
  return Array.from(new Set(addresses)).sort((a, b) => {
    const sa = splitAddress(a)
    const sb = splitAddress(b)
    const nameCmp = sa.name.localeCompare(sb.name, 'sv')
    if (nameCmp !== 0) return nameCmp
    return sa.number - sb.number
  })
}
