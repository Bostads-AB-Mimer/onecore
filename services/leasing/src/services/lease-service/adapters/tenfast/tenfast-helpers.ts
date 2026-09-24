// Tenfast requires literal brackets/commas — URLSearchParams percent-encodes them.
export const decodeTenfastQueryString = (qs: URLSearchParams): string =>
  qs
    .toString()
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']')
    .replace(/%2C/gi, ',')
