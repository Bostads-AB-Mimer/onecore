// Cosmetic: makes outgoing request URLs readable in logs. Tenfast accepts
// both the encoded and literal form.
export const decodeTenfastQueryString = (qs: URLSearchParams): string =>
  qs
    .toString()
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']')
    .replace(/%2C/gi, ',')
