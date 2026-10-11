import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "~ui/theme/context"
import { Icon } from "~ui/components/icon"
import { Shell } from "./features/layout/shell"
import { FileTree } from "./features/file-tree/file-tree"
import { CodeEditor } from "./features/editor/code-editor"
import { TabBar } from "./features/tabs/tab-bar"
import { Breadcrumb } from "./features/breadcrumb/breadcrumb"
import { TerminalPanel } from "./features/terminal/terminal-panel"
import { CommandPalette } from "./features/palette/command-palette"
import { CommandRegistryProvider, useCommandRegistry } from "./features/palette/registry"
import { WorkspaceProvider, useWorkspace } from "./features/workspace/context"
import { createPersisted, persist, persisted } from "./features/persist/state"
import { isTauri, pickFolder, pickSavePath, watchRoot, writeFile, onFsChange } from "./lib/tauri"

const LANG_LABEL: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  markdown: "Markdown",
  css: "CSS",
  html: "HTML",
  rust: "Rust",
  python: "Python",
  go: "Go",
  toml: "TOML",
  yaml: "YAML",
  shell: "Shell",
  plaintext: "Plain Text",
}

function ExternalChangeBanner() {
  const ws = useWorkspace()
  return (
    <Show when={ws.state.externalChanges.length > 0}>
      <div class="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b border-border-base bg-background-strong text-xs text-text-muted">
        <Icon name="warning" size="small" class="text-[var(--v2-text-text-warning,#e2b340)]" />
        <span class="truncate">
          {ws.state.externalChanges[0]!.name} changed on disk.
        </span>
        <div class="flex items-center gap-2 ml-auto">
          <button
            type="button"
            class="px-2 py-0.5 rounded border border-border-base hover:text-text-base"
            onClick={() => void ws.acceptExternal(ws.state.externalChanges[0]!.path)}
          >
            Reload
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded border border-border-base hover:text-text-base"
            onClick={() => ws.keepMine(ws.state.externalChanges[0]!.path)}
          >
            Keep mine
          </button>
        </div>
      </div>
    </Show>
  )
}

function Editor(props: { onCursor: (c: { line: number; column: number }) => void }) {
  const ws = useWorkspace()
  const theme = useTheme()
  const active = () => ws.state.tabs.find((t) => t.path === ws.state.activeTab)

  const saveAs = async () => {
    const tab = active()
    if (!tab || !isTauri) return
    const target = await pickSavePath(tab.path)
    if (typeof target !== "string") return
    await writeFile(target, tab.content)
    await ws.openFile(target)
  }

  return (
    <div class="h-full w-full flex flex-col bg-background-base min-h-0">
      <Breadcrumb />
      <ExternalChangeBanner />
      <div class="flex-1 min-h-0">
        <Show
          when={active()}
          fallback={
            <div class="h-full w-full flex items-center justify-center text-text-faint">
              <span>No file open — pick one from the explorer</span>
            </div>
          }
        >
          {(tab) => (
            <CodeEditor
              path={tab().path}
              value={tab().content}
              language={tab().language}
              theme={theme.mode()}
              initialView={ws.getView(tab().path)}
              onChange={(v) => ws.updateContent(tab().path, v)}
              onSave={() => void ws.saveFile(tab().path)}
              onSaveAs={saveAs}
              onCursorChange={props.onCursor}
              onViewChange={(view) => ws.setView(tab().path, view)}
            />
          )}
        </Show>
      </div>
    </div>
  )
}

function SidebarHeader() {
  const ws = useWorkspace()
  const openFolder = async () => {
    if (!isTauri) return
    const picked = await pickFolder()
    if (typeof picked !== "string") return
    await ws.openFolder(picked)
    persist({ root: picked, expanded: [], tabs: [], activeTab: null })
    await watchRoot(picked).catch(() => undefined)
  }
  return (
    <div class="flex items-center justify-between w-full gap-1">
      <span class="text-sm font-medium truncate">{ws.state.root?.split(/[\\/]/).pop() ?? "Explorer"}</span>
      <div class="flex items-center gap-1 shrink-0">
        <Show when={ws.state.root}>
          <button
            type="button"
            class="text-text-faint hover:text-text-base"
            title="New file (Ctrl+Shift+N)"
            onClick={async () => {
              if (!ws.state.root) return
              const name = window.prompt("New file name")
              if (name) await ws.newFile(ws.state.root, name)
            }}
          >
            <Icon name="plus-small" size="small" />
          </button>
          <button
            type="button"
            class="text-text-faint hover:text-text-base"
            title="Refresh"
            onClick={() => void ws.refreshAll()}
          >
            <Icon name="reset" size="small" />
          </button>
        </Show>
        <button type="button" class="text-text-faint hover:text-text-base" title="Open folder" onClick={openFolder}>
          <Icon name="folder" size="small" />
        </button>
      </div>
    </div>
  )
}

function Workspace() {
  const ws = useWorkspace()
  const theme = useTheme()
  const commands = useCommandRegistry()

  const [sidebarWidth, setSidebarWidth] = createPersisted("sidebarWidth", 260)
  const [sidebarOpen, setSidebarOpen] = createPersisted("sidebarOpen", true)
  const [bottomHeight, setBottomHeight] = createPersisted("bottomHeight", 240)
  const [bottomOpen, setBottomOpen] = createPersisted("bottomOpen", false)
  const [autoSave, setAutoSave] = createPersisted("autoSave", false)
  const [cursor, setCursor] = createSignal<{ line: number; column: number }>({ line: 1, column: 1 })

  const activeTab = () => ws.state.tabs.find((t) => t.path === ws.state.activeTab)
  const langLabel = () => LANG_LABEL[activeTab()?.language ?? "plaintext"] ?? activeTab()?.language ?? ""

  // ---- restore persisted session on startup ----
  let restored = false
  onMount(async () => {
    const saved = persisted()
    if (isTauri && saved.root && !restored) {
      restored = true
      await ws.restoreFolder(saved.root).catch(() => undefined)
      if (saved.expanded?.length) {
        ws.setExpanded(saved.expanded)
        for (const dir of saved.expanded) await ws.loadDir(dir).catch(() => undefined)
      }
      for (const path of saved.tabs ?? []) {
        await ws.openFile(path).catch(() => undefined)
      }
      if (saved.activeTab) ws.setActiveTab(saved.activeTab)
    }

    if (isTauri) {
      let gitTimer: number | undefined
      const scheduleGitRefresh = () => {
        if (gitTimer !== undefined) clearTimeout(gitTimer)
        gitTimer = window.setTimeout(() => void ws.loadGitStatus(), 400)
      }
      void onFsChange((change) => {
        const parts = change.path.split(/[\\/]/)
        parts.pop()
        void ws.refreshDir(parts.join("\\"))
        void ws.noteFsChange(change.path)
        scheduleGitRefresh()
      })
      onCleanup(() => {
        if (gitTimer !== undefined) clearTimeout(gitTimer)
      })
    }

    commands.register({ id: "file.save", title: "File: Save", run: () => { if (ws.state.activeTab) void ws.saveFile(ws.state.activeTab) } })
    commands.register({ id: "file.close", title: "File: Close Active Tab", run: () => { if (ws.state.activeTab) ws.closeTab(ws.state.activeTab) } })
    commands.register({ id: "file.closeAll", title: "File: Close All Tabs", run: () => { for (const t of [...ws.state.tabs]) ws.closeTab(t.path) } })
    commands.register({ id: "view.toggleTerminal", title: "View: Toggle Terminal", run: () => setBottomOpen(!bottomOpen()) })
    commands.register({ id: "view.toggleSidebar", title: "View: Toggle Sidebar", run: () => setSidebarOpen(!sidebarOpen()) })
    commands.register({ id: "workspace.refresh", title: "Workspace: Refresh Explorer", run: () => void ws.refreshAll() })
    commands.register({ id: "preferences.toggleAutoSave", title: "Preferences: Toggle Auto Save", run: () => setAutoSave(!autoSave()) })
  })

  // ---- persist open tabs / active tab ----
  createEffect(() => {
    const tabs = ws.state.tabs.map((t) => t.path)
    const active = ws.state.activeTab
    persist({ tabs, activeTab: active, expanded: ws.expandedPaths() })
  })

  // ---- auto save on tab switch / window blur ----
  onMount(() => {
    const onBlur = () => {
      if (autoSave()) {
        for (const tab of ws.state.tabs) if (ws.isDirty(tab.path)) void ws.saveFile(tab.path)
      }
    }
    window.addEventListener("blur", onBlur)
    onCleanup(() => window.removeEventListener("blur", onBlur))
  })

  // save the previously active tab when switching away
  let lastActive: string | null = null
  createEffect(() => {
    const active = ws.state.activeTab
    if (lastActive && lastActive !== active && autoSave()) {
      if (ws.isDirty(lastActive)) void ws.saveFile(lastActive)
    }
    lastActive = active
  })

  // ---- global shortcuts ----
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === "s") {
        e.preventDefault()
        if (ws.state.activeTab) void ws.saveFile(ws.state.activeTab)
        return
      }
      if (mod && key === "w") {
        e.preventDefault()
        if (ws.state.activeTab) ws.closeTab(ws.state.activeTab)
        return
      }
      if (mod && key === "b" && !e.shiftKey) {
        e.preventDefault()
        setSidebarOpen(!sidebarOpen())
        return
      }
      if (mod && e.key === "`") {
        e.preventDefault()
        setBottomOpen(!bottomOpen())
        return
      }
      if (mod && e.shiftKey && key === "n") {
        e.preventDefault()
        if (ws.state.root) {
          const name = window.prompt("New file name")
          if (name) void ws.newFile(ws.state.root, name)
        }
        return
      }
      if (mod && e.shiftKey && key === "e") {
        e.preventDefault()
        setSidebarOpen(true)
        return
      }
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <>
      <Shell
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        bottomHeight={bottomHeight}
        setBottomHeight={setBottomHeight}
        sidebarHeader={<SidebarHeader />}
        sidebar={<FileTree />}
        editorTabs={<TabBar />}
        editor={<Editor onCursor={setCursor} />}
        bottom={bottomOpen() ? <TerminalPanel cwd={ws.state.root} /> : undefined}
        onToggleTerminal={() => setBottomOpen(!bottomOpen())}
        statusBar={
          <span class="flex items-center gap-3">
            <Show when={activeTab()}>
              <span>
                Ln {cursor().line}, Col {cursor().column}
              </span>
              <span class="text-text-faint">·</span>
              <span>{langLabel()}</span>
              <span class="text-text-faint">·</span>
              <span>UTF-8</span>
              <span class="text-text-faint">·</span>
              <span>LF</span>
              <span class="text-text-faint">·</span>
            </Show>
            <Show when={autoSave()}>
              <span class="text-text-faint">auto-save</span>
            </Show>
            <span>
              {theme.name(theme.themeId())} · {theme.mode()}
            </span>
          </span>
        }
      />
      <CommandPalette />
    </>
  )
}

export function App() {
  return (
    <WorkspaceProvider>
      <CommandRegistryProvider>
        <Workspace />
      </CommandRegistryProvider>
    </WorkspaceProvider>
  )
}
