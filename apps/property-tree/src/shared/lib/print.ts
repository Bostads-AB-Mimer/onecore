// Marks the element to print. index.css hides everything else on the page
// while an element carries this attribute.
const PRINT_TARGET_ATTRIBUTE = 'data-print-target'

// Prints only the given element instead of the whole page. The attribute is
// set just for the print, so a regular Ctrl+P still prints the full page.
export const printElement = (element: HTMLElement): void => {
  element.setAttribute(PRINT_TARGET_ATTRIBUTE, '')
  window.addEventListener(
    'afterprint',
    () => element.removeAttribute(PRINT_TARGET_ATTRIBUTE),
    { once: true }
  )
  window.print()
}
