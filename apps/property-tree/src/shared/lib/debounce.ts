export function debounce<F extends (...args: any[]) => void>(
  callback: F,
  delay: number
): (...args: Parameters<F>) => void {
  let timer: NodeJS.Timeout | null = null

  return (...args: Parameters<F>) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      callback(...args)
    }, delay)
  }
}
