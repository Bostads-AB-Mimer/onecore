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
  return filename || undefined
}
