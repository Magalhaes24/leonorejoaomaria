'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { fetchSiteContent, upsertSiteContentBatch, CONTENT_DEFAULTS, type ContentKey } from '../lib/siteContent'
import { PALETTE_COLORS } from '../components/editor/palette'
import { EditorContext, type EditorContextValue } from './editorContextShared'

const EDIT_MODE_KEY = 'editor_edit_mode'

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [contentMap, setContentMap] = useState<Map<string, string>>(new Map())
  const [dirtyMap, setDirtyMap] = useState<Map<string, string>>(new Map()) // key → new value (pending save)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isEditMode, setIsEditModeState] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [contentLoaded, setContentLoaded] = useState(false)
  const originalMapRef = useRef<Map<string, string>>(new Map())

  // Load content from Supabase on mount
  // Safety net: if the DB is slow/unreachable, show defaults after 5s
  useEffect(() => {
    const timeout = setTimeout(() => setContentLoaded(true), 5000)
    fetchSiteContent().then((map) => {
      clearTimeout(timeout)
      setContentMap(map)
      originalMapRef.current = new Map(map)
      setContentLoaded(true)
    })
    return () => clearTimeout(timeout)
  }, [])

  // Apply palette colors as CSS variables whenever content or dirty map changes
  useEffect(() => {
    for (const color of PALETTE_COLORS) {
      const value = dirtyMap.get(color.key) ?? contentMap.get(color.key) ?? color.defaultValue
      document.documentElement.style.setProperty(color.cssVar, value)
    }
  }, [contentMap, dirtyMap])

  // Check admin auth on mount and subscribe to changes
  useEffect(() => {
    const checkAdmin = async (user: User | null) => {
      if (!user) { setIsAdmin(false); setIsEditModeState(false); return }
      const token = await user.getIdTokenResult()
      const isAdm = token.claims['admin'] === true
      setIsAdmin(isAdm)
      if (!isAdm) setIsEditModeState(false)
    }

    const unsubscribe = onAuthStateChanged(auth, checkAdmin)
    return unsubscribe
  }, [])

  // Restore edit mode from localStorage (only if admin)
  useEffect(() => {
    if (isAdmin) {
      const stored = localStorage.getItem(EDIT_MODE_KEY)
      if (stored === 'true') setIsEditModeState(true)
    }
  }, [isAdmin])

  const setEditMode = useCallback((v: boolean) => {
    if (!isAdmin) return
    setIsEditModeState(v)
    localStorage.setItem(EDIT_MODE_KEY, String(v))
  }, [isAdmin])

  const getContent = useCallback((key: string, fallback: string): string => {
    // Priority: dirty (unsaved) → loaded from DB → CONTENT_DEFAULTS → fallback
    if (dirtyMap.has(key)) return dirtyMap.get(key)!
    if (contentMap.has(key)) return contentMap.get(key)!
    const def = CONTENT_DEFAULTS[key as ContentKey]
    if (def?.value) return def.value
    return fallback
  }, [contentMap, dirtyMap])

  const updateContent = useCallback((key: string, value: string) => {
    setDirtyMap(prev => {
      const next = new Map(prev)
      next.set(key, value)
      return next
    })
  }, [])

  const saveAll = useCallback(async () => {
    if (dirtyMap.size === 0) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const items = Array.from(dirtyMap.entries()).map(([key, value]) => ({ key, value }))
      await upsertSiteContentBatch(items)
      // Merge dirty into contentMap and clear dirty
      setContentMap(prev => {
        const next = new Map(prev)
        for (const [k, v] of dirtyMap) next.set(k, v)
        originalMapRef.current = new Map(next)
        return next
      })
      setDirtyMap(new Map())
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao guardar. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }, [dirtyMap])

  const clearSaveError = useCallback(() => setSaveError(null), [])

  const revertAll = useCallback(() => {
    setDirtyMap(new Map())
  }, [])

  const value: EditorContextValue = {
    getContent,
    updateContent,
    isEditMode: isAdmin && isEditMode,
    setEditMode,
    isAdmin,
    saveAll,
    revertAll,
    dirtyCount: dirtyMap.size,
    isSaving,
    saveError,
    clearSaveError,
    contentLoaded,
  }

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
