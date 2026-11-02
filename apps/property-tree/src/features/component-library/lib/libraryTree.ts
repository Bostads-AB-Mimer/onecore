import { routes } from '@/shared/routes'

import { levelSearch, parseViewState, type ViewState } from './libraryUrlState'

export type LibraryTreeNode =
  | { level: 'categories' }
  | { level: 'category'; categoryId: string }
  | { level: 'type'; typeId: string }
  | { level: 'subtype'; subtypeId: string }

export type TreeNodeState = 'active' | 'in-path' | 'none'

export const treeNodeState = (
  view: ViewState | undefined,
  node: LibraryTreeNode
): TreeNodeState => {
  if (!view) return 'none'

  switch (node.level) {
    case 'categories':
      return view.level === 'categories' ? 'active' : 'in-path'
    case 'category':
      if (view.level === 'categories' || view.categoryId !== node.categoryId) {
        return 'none'
      }
      return view.level === 'types' ? 'active' : 'in-path'
    case 'type':
      if (view.level !== 'subtypes' && view.level !== 'subtype') return 'none'
      if (view.typeId !== node.typeId) return 'none'
      return view.level === 'subtypes' ? 'active' : 'in-path'
    case 'subtype':
      return view.level === 'subtype' && view.subtypeId === node.subtypeId
        ? 'active'
        : 'none'
  }
}

export const libraryHref = (state: ViewState): string =>
  `${routes.components}${levelSearch(state)}`

export const libraryViewFromLocation = (
  pathname: string,
  search: string
): ViewState | undefined =>
  pathname === routes.components
    ? parseViewState(new URLSearchParams(search))
    : undefined
