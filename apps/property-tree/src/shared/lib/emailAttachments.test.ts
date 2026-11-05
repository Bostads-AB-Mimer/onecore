import {
  EMAIL_ATTACHMENT_MAX_COUNT,
  EMAIL_ATTACHMENT_MAX_TOTAL_BYTES,
} from '@onecore/types'
import { describe, expect, it } from 'vitest'

import { addEmailAttachmentFiles } from './emailAttachments'

const fileOfSize = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type })

describe('addEmailAttachmentFiles', () => {
  it('adds allowed files', () => {
    const pdf = fileOfSize('a.pdf', 'application/pdf', 10)
    const png = fileOfSize('b.png', 'image/png', 10)

    const result = addEmailAttachmentFiles([], [pdf, png])

    expect(result.files).toEqual([pdf, png])
    expect(result.errors).toEqual([])
  })

  it('keeps already selected files', () => {
    const existing = fileOfSize('a.pdf', 'application/pdf', 10)
    const added = fileOfSize('b.pdf', 'application/pdf', 10)

    expect(addEmailAttachmentFiles([existing], [added]).files).toEqual([
      existing,
      added,
    ])
  })

  it('rejects disallowed and unknown file types', () => {
    const exe = fileOfSize('virus.exe', 'application/x-msdownload', 10)
    const unknown = fileOfSize('data.bin', '', 10)

    const result = addEmailAttachmentFiles([], [exe, unknown])

    expect(result.files).toEqual([])
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain('virus.exe')
  })

  it('rejects files beyond the max count', () => {
    const current = Array.from({ length: EMAIL_ATTACHMENT_MAX_COUNT }, (_, i) =>
      fileOfSize(`${i}.pdf`, 'application/pdf', 1)
    )
    const extra = fileOfSize('extra.pdf', 'application/pdf', 1)

    const result = addEmailAttachmentFiles(current, [extra])

    expect(result.files).toHaveLength(EMAIL_ATTACHMENT_MAX_COUNT)
    expect(result.errors).toEqual([expect.stringContaining('extra.pdf')])
  })

  it('rejects a file that would exceed the total size limit', () => {
    const big = fileOfSize(
      'big.pdf',
      'application/pdf',
      EMAIL_ATTACHMENT_MAX_TOTAL_BYTES - 5
    )
    const tooMuch = fileOfSize('more.pdf', 'application/pdf', 10)
    const fits = fileOfSize('small.pdf', 'application/pdf', 5)

    const result = addEmailAttachmentFiles([], [big, tooMuch, fits])

    expect(result.files).toEqual([big, fits])
    expect(result.errors).toEqual([expect.stringContaining('more.pdf')])
  })
})
