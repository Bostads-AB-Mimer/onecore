import { paths } from '@/shared/routes'

// Step anchors are 1-based and stable across reorders only by position, which
// is what a colleague means when they say "see step 3".
export const stepAnchorId = (stepNumber: number) => `steg-${stepNumber}`

export const stepNumberFromHash = (hash: string): number | null => {
  const match = /^#steg-(\d+)$/.exec(hash)
  return match ? Number(match[1]) : null
}

export const guideLink = (slug: string, stepNumber?: number) => {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const hash = stepNumber ? `#${stepAnchorId(stepNumber)}` : ''
  return `${origin}${paths.guide(slug)}${hash}`
}
