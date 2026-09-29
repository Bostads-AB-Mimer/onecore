/**
 * True when an Enter keydown would implicitly submit the form and should be
 * prevented. Textareas and the rich text editor keep their own Enter
 * behaviour, and a file input needs Enter to open the picker.
 */
export function blocksImplicitSubmit(
  key: string,
  target: EventTarget | null,
  isComposing: boolean
): boolean {
  if (key !== 'Enter' || isComposing) return false
  return target instanceof HTMLInputElement && target.type !== 'file'
}
