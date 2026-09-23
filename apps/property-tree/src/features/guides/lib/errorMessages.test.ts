import { saveErrorMessage, uploadErrorMessage } from './errorMessages'

describe('saveErrorMessage', () => {
  it('explains a taken slug and a failed validation', () => {
    expect(saveErrorMessage({ error: 'slug-taken' })).toContain('Sluggen')
    expect(saveErrorMessage({ error: 'Validation failed' })).toContain(
      'ogiltigt'
    )
  })

  it.each([
    [
      'image-not-in-step',
      'En bild hör inte till det steg den skickades med. Ladda om guiden och försök igen.',
    ],
    [
      'guide-modified',
      'Guiden har ändrats av någon annan sedan du öppnade den. Ladda om sidan för att se de senaste ändringarna.',
    ],
    [
      'category-not-found',
      'Kategorin finns inte längre. Välj en annan kategori.',
    ],
    [
      'step-belongs-to-other-guide',
      'Ett steg tillhör en annan guide. Ladda om guiden och försök igen.',
    ],
  ])('explains the backend code %s', (code, message) => {
    expect(saveErrorMessage({ error: code })).toBe(message)
  })

  it('falls back for unknown shapes', () => {
    expect(saveErrorMessage(new Error('boom'))).toBe(
      'Guiden kunde inte sparas. Försök igen.'
    )
  })
})

describe('uploadErrorMessage', () => {
  it('names the file and the reason core rejected it', () => {
    expect(uploadErrorMessage({ error: 'invalid-file-type' }, 'a.gif')).toBe(
      'a.gif: filtypen stöds inte. Använd PNG, JPG eller WEBP.'
    )
    expect(uploadErrorMessage({ error: 'invalid-file-size' }, 'a.png')).toBe(
      'a.png: filen är för stor. Max 5 MB.'
    )
    expect(uploadErrorMessage({ error: 'invalid-file-data' }, 'a.png')).toBe(
      'a.png: filen kunde inte läsas. Försök med en annan bild.'
    )
    expect(uploadErrorMessage({ error: 'alt-text-required' }, 'a.png')).toBe(
      'a.png: guiden är publicerad, så bilden behöver en alt-text.'
    )
  })

  it('falls back for network and unknown errors', () => {
    expect(uploadErrorMessage({ error: 'upload-failed' }, 'a.png')).toBe(
      'a.png: kunde inte laddas upp. Försök igen.'
    )
    expect(uploadErrorMessage(new Error('offline'), 'a.png')).toBe(
      'a.png: kunde inte laddas upp. Försök igen.'
    )
  })
})
