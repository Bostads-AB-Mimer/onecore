import { useEffect, useRef } from 'react'

interface UseScrollToSelectedOptions {
  isSelected: boolean
  itemType?: 'property' | 'building' | 'residence' | 'company'
  delay?: number
  behavior?: ScrollBehavior
}

export function useScrollToSelected<T extends HTMLElement = HTMLElement>({
  isSelected,
  itemType,
  delay = 100,
  behavior = 'smooth',
}: UseScrollToSelectedOptions) {
  const elementRef = useRef<T>(null)

  useEffect(() => {
    const shouldScroll =
      isSelected &&
      elementRef.current &&
      itemType &&
      ['property', 'building', 'residence'].includes(itemType)

    if (shouldScroll) {
      const timeout = setTimeout(() => {
        elementRef.current?.scrollIntoView({
          behavior,
          block: 'center',
          inline: 'nearest',
        })
      }, delay)

      return () => clearTimeout(timeout)
    }
  }, [isSelected, itemType, delay, behavior])

  return elementRef
}
