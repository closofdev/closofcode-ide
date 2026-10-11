import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "~ui/theme/context"
import { Icon } from "~ui/components/icon"
import { Shell } from "./features/layout/shell"
import { FileTree } from "./features/file-tree/file-tree"
import { CodeEditor } from "./features/editor/code-editor"
import { TerminalPanel } from "./features/terminal/terminal-panel"
import { CommandPalette } from "./features/palette/command-palette"
import { CommandRegistryProvider, useCommandRegistry } from "./features/palette/registry"
import { WorkspaceProvider, useWorkspace } from "./features/workspace/context"
import { isTauri, pickFolder, watchRoot, onFsChange } from "./lib/tauri"

function TabBar() {
  const ws = useWorkspace()
  return (
    <>
      <Show when={ws.state.tabs.length === 0}>
        <span class="px-3 text-sm text-text-faint">No open files</span>
      </Show>
      <For each={ws.state.tabs}>
        {(tab) => (
          <div
            data-slot="editor-tab"
            class="h-full px-3 flex items-center gap-2 border-r border-border-base text-sm cursor-pointer shrink-0"
            classList={{
              "bg-background-base text-text-base": ws.state.activeTab === tab.path,
              "bg-background-strong text-text-muted": ws.state.activeTab !== tab.path,
            }}
            onClick={() => ws.setActiveTab(tab.path)}
          >
            <span class="truncate max-w-[160px]">{tab.name}</span>
            <Show when={ws.isDirty(tab.path)}>
              <span class="size-1.5 rounded-full bg-primary shrink-0" />
            </Show>
            <button
              type="button"
              class="hover:text-text-base"
              onClick={(e) => {
                e.stopPropagation()
                ws.closeTab(tab.path)
              }}
            >
              <Icon name="circle-x" size="small" />
            </button>
          </div>
        )}
      </For>
    </>
  )
}

function Editor() {
  const ws = useWorkspace()
  const theme = useTheme()
  const active = () => ws.state.tabs.find((t) => t.path === ws.state.activeTab)
  return (
    <div class="h-full w-full bg-background-base">
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
            value={tab().content}
            language={tab().language}
            theme={theme.mode()}
            onChange={(v) => ws.updateContent(tab().path, v)}
            onSave={() => void ws.saveFile(tab().path)}
          />
        )}
      </Show>
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
            title="Refresh"
            onClick={() => void ws.refreshAll()}
          >
            <Icon name="reset" size="small" />
          </button>
        </Show>
        <button
          type="button"
          class="text-text-faint hover:text-text-base"
          title="Open folder"
          onClick={openFolder}
        >
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
  const [bottomOpen, setBottomOpen] = createSignal(false)

  onMount(() => {
    if (isTauri) {
      void onFsChange((change) => {
        const parts = change.path.split(/[\\/]/)
        parts.pop()
        void ws.refreshDir(parts.join("\\"))
      })
    }

    commands.register({
      id: "view.toggleTerminal",
      title: "View: Toggle Terminal",
      run: () => setBottomOpen((v) => !v),
    })
    commands.register({
      id: "file.save",
      title: "File: Save",
      run: () => {
        if (ws.state.activeTab) void ws.saveFile(ws.state.activeTab)
      },
    })
    commands.register({
      id: "file.close",
      title: "File: Close Active Tab",
      run: () => {
        if (ws.state.activeTab) ws.closeTab(ws.state.activeTab)
      },
    })
    commands.register({
      id: "file.closeAll",
      title: "File: Close All Tabs",
      run: () => {
        for (const tab of [...ws.state.tabs]) ws.closeTab(tab.path)
      },
    })
    commands.register({
      id: "workspace.refresh",
      title: "Workspace: Refresh Explorer",
      run: () => void ws.refreshAll(),
    })
  })

  createEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === "`") {
        e.preventDefault()
        setBottomOpen((v) => !v)
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (ws.state.activeTab) void ws.saveFile(ws.state.activeTab)
      }
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <>
      <Shell
        sidebarHeader={<SidebarHeader />}
        sidebar={<FileTree />}
        editorTabs={<TabBar />}
        editor={<Editor />}
        bottom={bottomOpen() ? <TerminalPanel cwd={ws.state.root} /> : undefined}
        onToggleTerminal={() => setBottomOpen((v) => !v)}
        statusBar={
          <span class="flex items-center gap-3">
            <span>
              {theme.name(theme.themeId())} · {theme.mode()}
            </span>
            <Show when={ws.state.root}>
              <span class="truncate max-w-[300px]">{ws.state.root}</span>
            </Show>
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
