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

interface WorkspaceState {
  root: string | null
  nodes: Record<string, FileNode>
  children: Record<string, string[]>
  expanded: Record<string, boolean>
  selected: string | null
  tabs: OpenTab[]
  activeTab: string | null
  gitChanges: Record<string, "added" | "modified" | "deleted" | "untracked" | "renamed">
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
  }
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>
