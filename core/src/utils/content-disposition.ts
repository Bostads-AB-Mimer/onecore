/*
 * The filename in a Content-Disposition header, quoted or not. Upstream
 * systems (Tenfast) send it unquoted, e.g.
 * `attachment; filename=Hyresavi 2026-11-30 - Avtal(1298, 1299).pdf`, which a
 * browser rejects because of the comma. Re-emit it with `ctx.attachment()`.
 */
export const filenameFromContentDisposition = (
  header: string
): string | undefined => {
  const match = /filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(header)
  const filename = (match?.[1] ?? match?.[2])?.replace(/[\r\n]/g, '').trim()
  return filename ? decodeUtf8SentAsLatin1(filename) : undefined
}

/*
 * Node reads header values as latin1, so a filename sent as raw UTF-8 arrives
 * with each multi-byte character split in two ("ö" as "Ã¶"). Reading the same
 * bytes as UTF-8 restores it. A name that really is latin1 is not valid UTF-8
 * and is kept as it is.
 */
const decodeUtf8SentAsLatin1 = (value: string): string => {
  const decoded = Buffer.from(value, 'latin1').toString('utf8')
  return decoded.includes('�') ? value : decoded
}
