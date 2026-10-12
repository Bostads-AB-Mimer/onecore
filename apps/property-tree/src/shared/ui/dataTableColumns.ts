export interface HideableColumn<T> {
  isEmpty?: (item: T) => boolean
}

export interface HideableAction<T> {
  isHidden?: (item: T) => boolean
}

export const visibleColumns = <T, C extends HideableColumn<T>>(
  columns: C[],
  data: T[]
): C[] =>
  data.length === 0
    ? columns
    : columns.filter(
        (column) =>
          !column.isEmpty || !data.every((item) => column.isEmpty!(item))
      )

export const visibleActions = <T, A extends HideableAction<T>>(
  actions: A[],
  item: T
): A[] => actions.filter((action) => !action.isHidden?.(item))
