import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { open, save } from "@tauri-apps/plugin-dialog"

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

export interface DirEntry {
  name: string
  path: string
  is_dir: boolean
}

export interface FsChange {
  path: string
  kind: string
}

export interface PtyOutput {
  id: number
  data: string
}

// ---- filesystem ----
export const readDir = (path: string) => invoke<DirEntry[]>("read_dir", { path })
export const readFile = (path: string) => invoke<string>("read_file", { path })
export const writeFile = (path: string, contents: string) => invoke<void>("write_file", { path, contents })
export const createFile = (path: string) => invoke<void>("create_file", { path })
export const createDir = (path: string) => invoke<void>("create_dir", { path })
export const renamePath = (from: string, to: string) => invoke<void>("rename_path", { from, to })
export const deletePath = (path: string) => invoke<void>("delete_path", { path })

export const pickFolder = () => open({ directory: true, multiple: false, title: "Open Folder" })
export const pickSavePath = (defaultPath?: string) => save({ title: "Save As", defaultPath })

export const watchRoot = (path: string) => invoke<void>("watch_root", { path })
export const onFsChange = (cb: (change: FsChange) => void): Promise<UnlistenFn> =>
  listen<FsChange>("fs-change", (e) => cb(e.payload))

// ---- git ----
export interface GitStatusResult {
  files: Record<string, string>
}
export const gitStatus = (root: string) => invoke<GitStatusResult>("git_status", { root })

// ---- terminal ----
export const ptyOpen = (cwd: string | null, cols: number, rows: number) =>
  invoke<number>("pty_open", { cwd, cols, rows })
export const ptyWrite = (id: number, data: string) => invoke<void>("pty_write", { id, data })
export const ptyResize = (id: number, cols: number, rows: number) => invoke<void>("pty_resize", { id, cols, rows })
export const ptyClose = (id: number) => invoke<void>("pty_close", { id })
export const onPtyOutput = (cb: (out: PtyOutput) => void): Promise<UnlistenFn> =>
  listen<PtyOutput>("pty-output", (e) => cb(e.payload))
export const onPtyExit = (cb: (id: number) => void): Promise<UnlistenFn> =>
  listen<number>("pty-exit", (e) => cb(e.payload))
