import { createSignal, For, onCleanup, Show } from "solid-js"
import { Icon } from "~ui/components/icon"
import { useWorkspace } from "../workspace/context"

export function TabBar() {
  const ws = useWorkspace()
  let strip: HTMLDivElement | undefined
  const [listOpen, setListOpen] = createSignal(false)

  // Vertical wheel over the tab strip scrolls it horizontally.
  const onWheel = (e: WheelEvent) => {
    if (!strip) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    strip.scrollLeft += e.deltaY
    e.preventDefault()
  }

  const onKey = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod || e.key !== "Tab") return
    const tabs = ws.state.tabs
    if (tabs.length < 2) return
    e.preventDefault()
    const idx = tabs.findIndex((t) => t.path === ws.state.activeTab)
    const next = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length
    const tab = tabs[next]
    if (tab) ws.setActiveTab(tab.path)
  }
  window.addEventListener("keydown", onKey)
  onCleanup(() => window.removeEventListener("keydown", onKey))

  return (
    <div class="flex items-center h-full w-full min-w-0">
      <div
        ref={strip}
        class="flex items-stretch h-full flex-1 min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={onWheel}
      >
        <Show when={ws.state.tabs.length === 0}>
          <span class="px-3 flex items-center text-sm text-text-faint">No open files</span>
        </Show>
        <For each={ws.state.tabs}>
          {(tab) => {
            const active = () => ws.state.activeTab === tab.path
            return (
              <div
                data-slot="editor-tab"
                data-active={active() || undefined}
                class="group relative h-full px-3 flex items-center gap-2 border-r border-border-base text-sm cursor-pointer shrink-0 max-w-[200px]"
                classList={{
                  "bg-background-base text-text-base": active(),
                  "bg-background-strong text-text-muted hover:text-text-base": !active(),
                }}
                title={tab.path}
                onClick={() => ws.setActiveTab(tab.path)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    ws.closeTab(tab.path)
                  }
                }}
              >
                {/* active indicator: a top accent bar, like an editor tab */}
                <span
                  class="absolute inset-x-0 top-0 h-[2px]"
                  classList={{ "bg-primary": active(), "bg-transparent": !active() }}
                />
                <span class="truncate">{tab.name}</span>
                <button
                  type="button"
                  class="shrink-0 size-4 flex items-center justify-center rounded hover:bg-[var(--v2-overlay-simple-overlay-hover)] opacity-0 group-hover:opacity-100 data-[dirty]:opacity-100"
                  data-dirty={ws.isDirty(tab.path) || undefined}
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation()
                    ws.closeTab(tab.path)
                  }}
                >
                  <Show
                    when={ws.isDirty(tab.path)}
                    fallback={<Icon name="close-small" size="small" />}
                  >
                    <span class="size-2 rounded-full bg-primary" />
                  </Show>
                </button>
              </div>
            )
          }}
        </For>
      </div>

      {/* overflow menu: full list of open tabs */}
      <Show when={ws.state.tabs.length > 0}>
        <div class="relative h-full shrink-0 border-l border-border-base">
          <button
            type="button"
            class="h-full px-2 flex items-center text-text-faint hover:text-text-base"
            title="All open tabs"
            onClick={() => setListOpen((v) => !v)}
          >
            <Icon name="chevron-down" size="small" />
          </button>
          <Show when={listOpen()}>
            <div class="fixed inset-0 z-40" onClick={() => setListOpen(false)} />
            <div class="absolute right-0 top-full z-50 mt-0.5 min-w-[240px] max-w-[400px] bg-background-strong border border-border-base rounded-md shadow-lg py-1 max-h-[60vh] overflow-auto">
              <For each={ws.state.tabs}>
                {(tab) => (
                  <button
                    type="button"
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--v2-overlay-simple-overlay-hover)]"
                    onClick={() => {
                      ws.setActiveTab(tab.path)
                      setListOpen(false)
                    }}
                  >
                    <Show when={ws.isDirty(tab.path)}>
                      <span class="size-1.5 rounded-full bg-primary shrink-0" />
                    </Show>
                    <span class="truncate" classList={{ "text-text-base": ws.state.activeTab === tab.path }}>
                      {tab.name}
                    </span>
                    <span class="ml-auto text-xs text-text-faint truncate max-w-[140px]">{tab.path}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
