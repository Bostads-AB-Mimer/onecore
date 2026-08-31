import { useState } from 'react'

import type { Note, NotesState } from '../types'

// Mock initial data - this would typically come from API based on entityType and entityId
const getInitialNotes = (entityType: string, entityId: string): Note[] => {
  if (entityType === 'tenant') {
    return [
      {
        id: 'note-1',
        content: 'Hyresgästen har framfört önskemål om renovering av badrum.',
        createdAt: '2023-11-15T14:30:00',
        createdBy: 'Maria Svensson',
        isPinned: false,
      },
      {
        id: 'note-2',
        content:
          'Uppföljning av vattenläcka. Allt åtgärdat enligt hyresgästen.',
        createdAt: '2023-12-02T09:15:00',
        createdBy: 'Johan Karlsson',
        isPinned: false,
      },
      {
        id: 'note-3',
        content:
          'Hyresgästen ringer ofta på kvällstid. Försök att ta kontakt på dagtid om möjligt.',
        createdAt: '2023-10-22T16:45:00',
        createdBy: 'Lisa Andersson',
        isPinned: true,
      },
    ]
  } else if (entityType === 'parkingSpace') {
    return [
      {
        id: 'parking-note-1',
        content:
          'Bilplatsen har problem med dränering efter regn. Bör ses över.',
        createdAt: '2023-11-20T10:30:00',
        createdBy: 'Erik Johansson',
        isPinned: true,
        category: 'Underhåll',
      },
      {
        id: 'parking-note-2',
        content:
          'Hyresgäst rapporterade att grannbilplats blockerar ibland. Pratat med granne.',
        createdAt: '2023-12-01T14:15:00',
        createdBy: 'Anna Petersson',
        isPinned: false,
        category: 'Klagomål',
      },
    ]
  }
  return []
}

export function useNotesState(
  entityType: string,
  entityId: string,
  categories: string[]
) {
  const [state, setState] = useState<NotesState>({
    notes: getInitialNotes(entityType, entityId),
    newNote: '',
    selectedCategory: categories[0] || undefined,
    isAddingNote: false,
  })

  const handleAddNote = () => {
    if (state.newNote.trim()) {
      const currentDate = new Date()
      const newNoteObj: Note = {
        id: `${entityType}-note-${Date.now()}`,
        content: state.newNote,
        createdAt: currentDate.toISOString(),
        createdBy: 'Användare',
        isPinned: false,
        category: categories.length > 0 ? state.selectedCategory : undefined,
      }

      setState((prev) => ({
        ...prev,
        notes: [newNoteObj, ...prev.notes],
        newNote: '',
        isAddingNote: false,
      }))
    }
  }

  const handleDeleteNote = (id: string) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.id !== id),
    }))
  }

  const handleTogglePin = (id: string) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((note) =>
        note.id === id ? { ...note, isPinned: !note.isPinned } : note
      ),
    }))
  }

  const startAddingNote = () => {
    setState((prev) => ({ ...prev, isAddingNote: true }))
  }

  const cancelAddingNote = () => {
    setState((prev) => ({
      ...prev,
      isAddingNote: false,
      newNote: '',
      selectedCategory: categories[0] || undefined,
    }))
  }

  const updateNewNote = (content: string) => {
    setState((prev) => ({ ...prev, newNote: content }))
  }

  const updateSelectedCategory = (category: string) => {
    setState((prev) => ({ ...prev, selectedCategory: category }))
  }

  // Sort notes: pinned notes first, then by creation date
  const sortedNotes = [...state.notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return {
    state,
    sortedNotes,
    handleAddNote,
    handleDeleteNote,
    handleTogglePin,
    startAddingNote,
    cancelAddingNote,
    updateNewNote,
    updateSelectedCategory,
  }
}
