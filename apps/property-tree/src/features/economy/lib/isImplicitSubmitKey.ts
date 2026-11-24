/**
 * True when a key press would submit the surrounding form implicitly: Enter
 * in a single-line input. A textarea needs Enter for new lines, and buttons
 * handle Enter themselves, so neither counts.
 */
export function isImplicitSubmitKey(
  key: string,
  targetTagName: string | undefined
): boolean {
  return key === 'Enter' && targetTagName === 'INPUT'
}
