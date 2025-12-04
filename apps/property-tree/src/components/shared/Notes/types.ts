export interface Note {
  id: string
  content: string
  createdAt: string
  createdBy: string
  isPinned: boolean
  category?: string
}

export interface NotesProps {
  entityType: string
  entityId: string
  title?: string
  placeholder?: string
  emptyMessage?: string
  categories?: string[]
  showCategory?: boolean
}

export interface NotesState {
  notes: Note[]
  newNote: string
  selectedCategory?: string
  isAddingNote: boolean
}
