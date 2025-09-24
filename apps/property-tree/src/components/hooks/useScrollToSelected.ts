import { useEffect, useRef } from 'react'

interface UseScrollToSelectedOptions {
  isSelected: boolean
  delay?: number
  behavior?: ScrollBehavior
}

export function useScrollToSelected<T extends HTMLElement = HTMLElement>({
  isSelected,
  delay = 100,
  behavior = 'smooth'
}: UseScrollToSelectedOptions) {
  const elementRef = useRef<T>(null)

  useEffect(() => {
    if (isSelected && elementRef.current) {
      const timeout = setTimeout(() => {
        elementRef.current?.scrollIntoView({
          behavior,
          block: 'center',
          inline: 'nearest'
        })
      }, delay)

      return () => clearTimeout(timeout)
    }
  }, [isSelected, delay, behavior])

  return elementRef
}