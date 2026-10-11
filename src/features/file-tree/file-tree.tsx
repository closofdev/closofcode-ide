import { createSignal, For, Show } from "solid-js"
import { Icon } from "~ui/components/icon"
import { FileIcon } from "~ui/components/file-icon"
import { useWorkspace } from "../workspace/context"

function dirOf(p: string) {
  const parts = p.split(/[\\/]/)
  parts.pop()
  return parts.join(p.includes("\\") ? "\\" : "/")
}

const GIT_COLORS: Record<string, string> = {
  added: "var(--v2-text-text-success, #4ade80)",
  untracked: "var(--v2-text-text-success, #4ade80)",
  modified: "var(--v2-text-text-warning, #e2b340)",
  renamed: "var(--v2-text-text-warning, #e2b340)",
  deleted: "var(--v2-text-text-critical, #f87171)",
}

const GIT_LETTERS: Record<string, string> = {
  added: "A",
  untracked: "U",
  modified: "M",
  renamed: "R",
  deleted: "D",
}

function Row(props: { path: string; depth: number }) {
  const ws = useWorkspace()
  const [menu, setMenu] = createSignal(false)
  const node = () => ws.node(props.path)!
  const isDir = () => node().type === "directory"
  const isOpen = () => ws.isExpanded(props.path)
  const isSelected = () => ws.state.selected === props.path
  const change = () => ws.gitChange(props.path)

  // For directories, show a coloured dot when anything beneath them changed.
  const dirDirty = () => {
    if (!isDir()) return false
    const prefix = props.path.endsWith("\\") || props.path.endsWith("/") ? props.path : props.path + "\\"
    const prefixFwd = props.path + "/"
    return Object.keys(ws.state.gitChanges).some((p) => p.startsWith(prefix) || p.startsWith(prefixFwd))
  }

  const activate = () => {
    if (isDir()) {
      ws.toggleDir(props.path)
      ws.setSelected(props.path)
    } else {
      void ws.openFile(props.path)
    }
  }

  const targetDir = () => (isDir() ? props.path : dirOf(props.path))

  const promptNewFile = async () => {
    setMenu(false)
    const name = window.prompt("New file name")
    if (name) await ws.newFile(targetDir(), name)
  }
  const promptNewFolder = async () => {
    setMenu(false)
    const name = window.prompt("New folder name")
    if (name) await ws.newFolder(targetDir(), name)
  }
  const confirmDelete = async () => {
    setMenu(false)
    if (window.confirm(`Delete ${node().name}?`)) await ws.remove(props.path)
  }

  return (
    <>
      <div
        data-slot="file-tree-v2-row"
        data-selected={isSelected() || undefined}
        role="treeitem"
        aria-expanded={isDir() ? isOpen() : undefined}
        aria-selected={isSelected()}
        tabindex="0"
        class="relative flex items-center gap-1.5 h-7 pr-2 rounded-md cursor-pointer text-text-muted hover:bg-[var(--v2-overlay-simple-overlay-hover)] hover:text-text-base"
        classList={{ "bg-[var(--v2-overlay-simple-overlay-pressed)] text-text-base": isSelected() }}
        style={{ "padding-left": `${8 + props.depth * 12}px` }}
        title={props.path}
        onClick={activate}
        onContextMenu={(e) => {
          e.preventDefault()
          ws.setSelected(props.path)
          setMenu(true)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            activate()
          }
        }}
      >
        <Show
          when={isDir()}
          fallback={<FileIcon node={{ path: props.path, type: "file" }} class="size-4 shrink-0" />}
        >
          <span data-slot="file-tree-v2-chevron" class="size-4 flex items-center justify-center shrink-0">
            <Icon name={isOpen() ? "chevron-down" : "chevron-right"} size="small" />
          </span>
        </Show>
        <span class="truncate text-sm" classList={{ "text-text-base": !!change() || dirDirty() }}>
          {node().name}
        </span>

        {/* git status: letter for files, dot for changed directories */}
        <Show when={!isDir() && change()}>
          <span class="ml-auto text-xs font-medium shrink-0" style={{ color: GIT_COLORS[change()!] }}>
            {GIT_LETTERS[change()!]}
          </span>
        </Show>
        <Show when={isDir() && dirDirty()}>
          <span class="ml-auto size-1.5 rounded-full shrink-0" style={{ "background-color": GIT_COLORS.modified }} />
        </Show>

        <Show when={menu()}>
          <div class="fixed inset-0 z-40" onClick={() => setMenu(false)} onContextMenu={(e) => e.preventDefault()} />
          <div class="absolute z-50 top-full left-4 mt-0.5 min-w-[160px] bg-background-strong border border-border-base rounded-md shadow-lg py-1 text-sm">
            <MenuItem label="New File" onClick={promptNewFile} />
            <MenuItem label="New Folder" onClick={promptNewFolder} />
            <div class="h-px bg-border-base my-1" />
            <MenuItem label="Delete" danger onClick={confirmDelete} />
          </div>
        </Show>
      </div>
      <Show when={isDir() && isOpen()}>
        <For each={ws.childPaths(props.path)}>{(child) => <Row path={child} depth={props.depth + 1} />}</For>
      </Show>
    </>
  )
}

function MenuItem(props: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 hover:bg-[var(--v2-overlay-simple-overlay-hover)]"
      classList={{ "text-[var(--v2-text-text-critical)]": props.danger }}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}

export function FileTree() {
  const ws = useWorkspace()
  return (
    <div data-component="file-tree-v2" class="p-1 flex flex-col gap-0.5">
      <Show
        when={ws.state.root}
        fallback={<div class="p-3 text-sm text-text-faint">No folder open</div>}
      >
        <For each={ws.rootChildren()}>{(child) => <Row path={child} depth={0} />}</For>
      </Show>
    </div>
  )
}
