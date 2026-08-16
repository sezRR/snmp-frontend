import * as React from "react"
import type { z } from "zod"

// Client-owned, disposable state (saved views, UI preferences). It
// never reaches the backend, so it lives in localStorage and is validated on
// read — a hand-edited or stale entry falls back to the default instead of
// crashing the sidebar.

export interface LocalStore<T> {
  get: () => T
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: () => void) => () => void
}

export function createLocalStore<T>(
  key: string,
  fallback: T,
  schema: z.ZodType<T>
): LocalStore<T> {
  let cached: T | undefined
  const listeners = new Set<() => void>()

  const read = (): T => {
    if (cached !== undefined) return cached
    try {
      const raw = localStorage.getItem(key)
      const parsed = raw ? schema.safeParse(JSON.parse(raw)) : null
      cached = parsed?.success ? parsed.data : fallback
    } catch {
      cached = fallback
    }
    return cached
  }

  const write = (value: T) => {
    cached = value
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // quota or private mode; the in-memory value still drives this tab
    }
    for (const listener of listeners) listener()
  }

  // Other tabs edit the same key; drop the cache so the next read re-parses.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key) return
    cached = undefined
    for (const listener of listeners) listener()
  }

  return {
    get: read,
    set: (next) =>
      write(
        typeof next === "function" ? (next as (prev: T) => T)(read()) : next
      ),
    subscribe: (listener) => {
      listeners.add(listener)
      if (listeners.size === 1)
        window.addEventListener("storage", handleStorage)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0)
          window.removeEventListener("storage", handleStorage)
      }
    },
  }
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return React.useSyncExternalStore(store.subscribe, store.get, store.get)
}
