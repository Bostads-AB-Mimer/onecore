import { useReducer } from 'react'

import type { GuideWithUrls } from '@/entities/guide'

import { editorReducer, emptyState, fromGuide } from '../lib/editorState'

export function useGuideEditorState(initialGuide?: GuideWithUrls) {
  return useReducer(editorReducer, initialGuide, (guide) =>
    guide ? fromGuide(guide) : emptyState()
  )
}
