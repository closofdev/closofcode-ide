import { createSignal } from "solid-js"

const KEY = "closofcode.state.v1"

export interface PersistedState {
  sidebarWidth?: number
  sidebarOpen?: boolean
  bottomHeight?: number
  bottomOpen?: boolean
  root?: string | null
  expanded?: string[]
  tabs?: string[]
  activeTab?: string | null
  autoSave?: boolean
}

function read(): PersistedState {
  if (typeof localStorage !== "object") return {}
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch {
    return {}
  }
}

let current: PersistedState = read()
let timer: number | undefined

function flush() {
  if (typeof localStorage !== "object") return
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {}
}

/** Merge a partial state update and persist it (debounced). */
export function persist(patch: Partial<PersistedState>) {
  current = { ...current, ...patch }
  if (timer !== undefined) clearTimeout(timer)
  timer = window.setTimeout(flush, 250)
}

/** Read the persisted snapshot loaded at startup. */
export function persisted(): PersistedState {
  return current
}

/**
 * A reactive mirror of a single persisted field, for values that must drive
 * the UI (layout sizes, toggles). Writes through to storage on change.
 */
export function createPersisted<T extends keyof PersistedState>(
  key: T,
  fallback: NonNullable<PersistedState[T]>,
) {
  const initial = (current[key] ?? fallback) as NonNullable<PersistedState[T]>
  const [value, setValue] = createSignal<NonNullable<PersistedState[T]>>(initial)
  const set = (v: NonNullable<PersistedState[T]>) => {
    setValue(() => v)
    persist({ [key]: v } as Partial<PersistedState>)
  }
  return [value, set] as const
}
