/**
 * A search box hint for a partly typed personnummer: the search only matches
 * a full one (10 or 12 digits), and a part would otherwise look like "no
 * hits for this person".
 */
export function personnummerSearchHint(search: string): string | undefined {
  return /^\d+$/.test(search) &&
    search.length >= 4 &&
    search.length !== 10 &&
    search.length !== 12
    ? 'Ange hela personnumret (10 eller 12 siffror) för att söka på personnummer.'
    : undefined
}
