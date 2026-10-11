import { Show, type Accessor, type JSX } from "solid-js"
import { ResizeHandle } from "~ui/components/resize-handle"

export interface ShellProps {
  sidebar?: JSX.Element
  sidebarHeader?: JSX.Element
  editor: JSX.Element
  editorTabs?: JSX.Element
  bottom?: JSX.Element
  statusBar?: JSX.Element
  sidebarWidth: Accessor<number>
  setSidebarWidth: (w: number) => void
  sidebarOpen: Accessor<boolean>
  setSidebarOpen: (v: boolean) => void
  bottomHeight: Accessor<number>
  setBottomHeight: (h: number) => void
  onToggleTerminal?: () => void
  onToggleSidebar?: () => void
}

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 560

export function Shell(props: ShellProps) {
  return (
    <div class="h-dvh w-screen flex flex-col bg-background-base text-text-base overflow-hidden">
      {/* title bar */}
      <div class="h-9 shrink-0 flex items-center px-3 border-b border-border-base bg-background-strong">
        <div class="text-sm font-medium">ClosofCode IDE</div>
      </div>

      <div class="flex-1 flex min-h-0">
        {/* sidebar */}
        <Show when={props.sidebarOpen()}>
          <aside
            class="shrink-0 flex flex-col min-h-0 bg-background-strong border-r border-border-base"
            style={{ width: `${props.sidebarWidth()}px` }}
          >
            <div class="h-9 shrink-0 flex items-center px-3 border-b border-border-base">{props.sidebarHeader}</div>
            <div class="flex-1 min-h-0 overflow-auto">{props.sidebar}</div>
          </aside>
          <ResizeHandle
            direction="horizontal"
            edge="start"
            size={props.sidebarWidth()}
            min={SIDEBAR_MIN}
            max={SIDEBAR_MAX}
            collapseThreshold={140}
            onResize={props.setSidebarWidth}
            onCollapse={() => props.setSidebarOpen(false)}
          />
        </Show>

        {/* editor column */}
        <div class="flex-1 flex flex-col min-h-0 min-w-0">
          <div class="h-9 shrink-0 flex items-center border-b border-border-base bg-background-base overflow-x-auto">
            {props.editorTabs}
          </div>
          <div class="flex-1 min-h-0 min-w-0">{props.editor}</div>
          <Show when={props.bottom}>
            <div
              class="shrink-0 border-t border-border-base bg-background-strong overflow-hidden"
              style={{ height: `${props.bottomHeight()}px` }}
            >
              {props.bottom}
            </div>
          </Show>
        </div>
      </div>

      {/* status bar */}
      <div class="h-6 shrink-0 flex items-center justify-between px-3 border-t border-border-base bg-background-strong text-xs text-text-muted">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="hover:text-text-base"
            onClick={() => props.setSidebarOpen(!props.sidebarOpen())}
            title="Toggle sidebar (Ctrl+B)"
          >
            Sidebar
          </button>
          <button
            type="button"
            class="hover:text-text-base"
            onClick={() => props.onToggleTerminal?.()}
            title="Toggle terminal (Ctrl+`)"
          >
            Terminal
          </button>
        </div>
        <div>{props.statusBar}</div>
      </div>
    </div>
  )
}
