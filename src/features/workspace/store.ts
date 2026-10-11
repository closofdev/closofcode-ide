import { createStore } from "solid-js/store"
import type { DirEntry } from "../../lib/tauri"

export interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
  loading?: boolean
  ignored?: boolean
  change?: "added" | "modified" | "deleted"
}

export interface OpenTab {
  path: string
  name: string
  content: string
  savedContent: string
  language: string
  view?: { cursorLine: number; cursorColumn: number; scrollTop: number }
}

/** A file that changed on disk while it was open and dirty. */
export interface ExternalChange {
  path: string
  name: string
}

interface WorkspaceState {
  root: string | null
  nodes: Record<string, FileNode>
  children: Record<string, string[]>
  expanded: Record<string, boolean>
  selected: string | null
  tabs: OpenTab[]
  activeTab: string | null
  gitChanges: Record<string, "added" | "modified" | "deleted" | "untracked" | "renamed">
  externalChanges: ExternalChange[]
}

const langFromPath = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    rs: "rust",
    py: "python",
    go: "go",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
  }
  return map[ext] ?? "plaintext"
}

interface WorkspaceDeps {
  readDir: (path: string) => Promise<DirEntry[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, contents: string) => Promise<void>
  createFile?: (path: string) => Promise<void>
  createDir?: (path: string) => Promise<void>
  renamePath?: (from: string, to: string) => Promise<void>
  deletePath?: (path: string) => Promise<void>
  gitStatus?: (root: string) => Promise<{ files: Record<string, string> }>
}

export function createWorkspaceStore(deps: WorkspaceDeps) {
  const [state, setState] = createStore<WorkspaceState>({
    root: null,
    nodes: {},
    children: {},
    expanded: {},
    selected: null,
    tabs: [],
    activeTab: null,
    gitChanges: {},
    externalChanges: [],
  })

  const rootChildren = () => (state.root ? state.children[state.root] ?? [] : [])
  const node = (path: string): FileNode | undefined => state.nodes[path]
  const childPaths = (path: string): string[] => state.children[path] ?? []
  const isExpanded = (path: string) => !!state.expanded[path]

  async function loadDir(path: string) {
    const entries = await deps.readDir(path)
    const childPaths: string[] = []
    const nodesPatch: Record<string, FileNode> = {}
    for (const entry of entries) {
      nodesPatch[entry.path] = {
        name: entry.name,
        path: entry.path,
        type: entry.is_dir ? "directory" : "file",
      }
      childPaths.push(entry.path)
    }
    setState("nodes", (n) => ({ ...n, ...nodesPatch }))
    setState("children", path, childPaths)
    // drop stale children entries that no longer exist
    const stale = Object.keys(state.children).filter((p) => p !== path && !state.nodes[p] && p.startsWith(path))
    for (const s of stale) setState("children", s, undefined as any)
  }

  async function openFolder(path: string) {
    setState("root", path)
    setState("nodes", {})
    setState("children", {})
    setState("expanded", {})
    setState("selected", null)
    setState("gitChanges", {})
    await loadDir(path)
    await loadGitStatus()
  }

  async function toggleDir(path: string) {
    if (isExpanded(path)) {
      setState("expanded", path, false)
      return
    }
    setState("expanded", path, true)
    if (!state.children[path]) await loadDir(path)
  }

  async function openFile(path: string) {
    setState("selected", path)
    if (state.tabs.some((t) => t.path === path)) {
      setState("activeTab", path)
      return
    }
    const content = await deps.readFile(path)
    const name = path.split(/[\\/]/).pop() ?? path
    setState("tabs", (tabs) => [...tabs, { path, name, content, savedContent: content, language: langFromPath(path) }])
    setState("activeTab", path)
  }

  function updateContent(path: string, content: string) {
    setState("tabs", (t) => t.path === path, "content", content)
  }

  async function saveFile(path: string) {
    const tab = state.tabs.find((t) => t.path === path)
    if (!tab) return
    await deps.writeFile(path, tab.content)
    setState("tabs", (t) => t.path === path, "savedContent", tab.content)
  }

  function closeTab(path: string) {
    const idx = state.tabs.findIndex((t) => t.path === path)
    const next = state.tabs.filter((t) => t.path !== path)
    setState("tabs", next)
    if (state.activeTab === path) {
      const fallback = next[Math.min(idx, next.length - 1)]?.path ?? null
      setState("activeTab", fallback)
    }
  }

  function isDirty(path: string) {
    const tab = state.tabs.find((t) => t.path === path)
    return !!tab && tab.content !== tab.savedContent
  }

  async function refreshDir(path: string) {
    if (state.children[path]) await loadDir(path)
  }

  async function refreshAll() {
    const expanded = Object.keys(state.expanded).filter((p) => state.expanded[p])
    if (state.root) await loadDir(state.root)
    for (const dir of expanded) {
      if (state.nodes[dir]) await loadDir(dir)
    }
    await loadGitStatus()
  }

  async function reloadFile(path: string) {
    const tab = state.tabs.find((t) => t.path === path)
    if (!tab) return
    const content = await deps.readFile(path)
    setState("tabs", (t) => t.path === path, "content", content)
    setState("tabs", (t) => t.path === path, "savedContent", content)
  }

  function setSelected(path: string | null) {
    setState("selected", path)
  }

  function setActiveTab(path: string | null) {
    setState("activeTab", path)
  }

  async function loadGitStatus() {
    if (!state.root || !deps.gitStatus) return
    const result = await deps.gitStatus(state.root).catch(() => null)
    setState("gitChanges", (result?.files as any) ?? {})
  }

  function gitChange(path: string): "added" | "modified" | "deleted" | "untracked" | "renamed" | undefined {
    return state.gitChanges[path]
  }

  function setView(path: string, view: { cursorLine: number; cursorColumn: number; scrollTop: number }) {
    setState("tabs", (t) => t.path === path, "view", view)
  }

  function getView(path: string) {
    return state.tabs.find((t) => t.path === path)?.view
  }

  async function newFile(dirPath: string, name: string) {
    if (!deps.createFile) return
    const full = `${dirPath.replace(/[\\/]$/, "")}${sep(dirPath)}${name}`
    await deps.createFile(full)
    await loadDir(dirPath)
    await openFile(full)
  }

  async function newFolder(dirPath: string, name: string) {
    if (!deps.createDir) return
    const full = `${dirPath.replace(/[\\/]$/, "")}${sep(dirPath)}${name}`
    await deps.createDir(full)
    await loadDir(dirPath)
  }

  async function remove(path: string) {
    if (!deps.deletePath) return
    await deps.deletePath(path)
    const parts = path.split(/[\\/]/)
    parts.pop()
    closeTab(path)
    await loadDir(parts.join(sep(path)))
  }

  function sep(p: string) {
    return p.includes("\\") ? "\\" : "/"
  }

  /** Expand all ancestor folders of a path so it becomes visible in the tree. */
  async function revealPath(path: string) {
    const root = state.root
    if (!root) return
    const s = sep(root)
    const rootParts = root.split(/[\\/]/).filter(Boolean)
    const parts = path.split(/[\\/]/).filter(Boolean)
    let acc = root.replace(/[\\/]$/, "")
    for (let i = rootParts.length; i < parts.length - 1; i++) {
      acc = `${acc}${s}${parts[i]}`
      if (!state.expanded[acc]) {
        setState("expanded", acc, true)
        if (!state.children[acc]) await loadDir(acc)
      }
    }
    setState("selected", path)
  }

  async function rename(path: string, newName: string) {
    if (!deps.renamePath || !newName.trim()) return
    const s = sep(path)
    const parts = path.split(/[\\/]/)
    parts.pop()
    const parent = parts.join(s)
    const to = `${parent}${s}${newName.trim()}`
    if (to === path) return
    await deps.renamePath(path, to)
    // retarget any open tab
    const idx = state.tabs.findIndex((t) => t.path === path)
    if (idx >= 0) {
      const name = newName.trim()
      setState("tabs", idx, { path: to, name, language: langFromPath(to) })
      if (state.activeTab === path) setState("activeTab", to)
    }
    await loadDir(parent)
  }

  /** Called when a watched path changed on disk. If an open, dirty tab's file
   *  changed, record it so the UI can offer to reload. */
  async function noteFsChange(path: string) {
    const tab = state.tabs.find((t) => t.path === path)
    if (!tab) return
    const onDisk = await deps.readFile(path).catch(() => null)
    if (onDisk === null) return
    // Nothing to warn about if the disk content already matches what we saved.
    if (onDisk === tab.savedContent) {
      setState("externalChanges", (list) => list.filter((e) => e.path !== path))
      return
    }
    const dirty = tab.content !== tab.savedContent
    if (dirty) {
      if (!state.externalChanges.some((e) => e.path === path)) {
        setState("externalChanges", (list) => [...list, { path, name: tab.name }])
      }
    } else {
      // Not dirty: adopt the new content silently.
      setState("tabs", (t) => t.path === path, "content", onDisk)
      setState("tabs", (t) => t.path === path, "savedContent", onDisk)
      setState("externalChanges", (list) => list.filter((e) => e.path !== path))
    }
  }

  function dismissExternal(path: string) {
    setState("externalChanges", (list) => list.filter((e) => e.path !== path))
  }

  async function acceptExternal(path: string) {
    await reloadFile(path)
    dismissExternal(path)
  }

  function keepMine(path: string) {
    // Treat the in-memory content as the source of truth going forward.
    const tab = state.tabs.find((t) => t.path === path)
    if (tab) setState("tabs", (t) => t.path === path, "savedContent", tab.content)
    dismissExternal(path)
  }

  /** Persist-relevant snapshot: which folders are expanded. */
  function expandedPaths(): string[] {
    return Object.keys(state.expanded).filter((p) => state.expanded[p])
  }

  function setExpanded(paths: string[]) {
    const next: Record<string, boolean> = {}
    for (const p of paths) next[p] = true
    setState("expanded", next)
  }

  /** Re-open a folder without resetting the root guard (used on startup). */
  async function restoreFolder(path: string) {
    setState("root", path)
    setState("nodes", {})
    setState("children", {})
    setState("gitChanges", {})
    await loadDir(path)
    await loadGitStatus()
  }

  return {
    state,
    rootChildren,
    node,
    childPaths,
    isExpanded,
    openFolder,
    loadDir,
    toggleDir,
    openFile,
    updateContent,
    saveFile,
    closeTab,
    isDirty,
    refreshDir,
    refreshAll,
    reloadFile,
    setSelected,
    setActiveTab,
    newFile,
    newFolder,
    remove,
    loadGitStatus,
    gitChange,
    setView,
    getView,
    revealPath,
    rename,
    noteFsChange,
    dismissExternal,
    acceptExternal,
    keepMine,
    expandedPaths,
    setExpanded,
    restoreFolder,
  }
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>
