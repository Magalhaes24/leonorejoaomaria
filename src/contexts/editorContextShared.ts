import { createContext } from 'react'

export interface EditorContextValue {
  getContent: (key: string, fallback: string) => string
  updateContent: (key: string, value: string) => void
  isEditMode: boolean
  setEditMode: (v: boolean) => void
  isAdmin: boolean
  saveAll: () => Promise<void>
  revertAll: () => void
  dirtyCount: number
  isSaving: boolean
  saveError: string | null
  clearSaveError: () => void
  contentLoaded: boolean
}

export const EditorContext = createContext<EditorContextValue | null>(null)
