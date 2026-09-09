import { useContext } from 'react'
import { EditorContext, type EditorContextValue } from './editorContextShared'

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider')
  return ctx
}

export function useContent(key: string, fallback: string): string {
  return useEditor().getContent(key, fallback)
}
