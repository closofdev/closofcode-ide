import { For, Show } from "solid-js"
import { useWorkspace } from "../workspace/context"

/** Path breadcrumb above the editor. Clicking a segment reveals it in the tree. */
export function Breadcrumb() {
  const ws = useWorkspace()

  const segments = () => {
    const root = ws.state.root
    const active = ws.state.activeTab
    if (!root || !active) return []
    const sepChar = root.includes("\\") ? "\\" : "/"
    const rootNorm = root.replace(/[\\/]$/, "")
    if (!active.startsWith(rootNorm)) return []
    const rel = active.slice(rootNorm.length).replace(/^[\\/]/, "")
    const parts = rel.split(/[\\/]/).filter(Boolean)
    const acc: { label: string; path: string }[] = [{ label: root.split(/[\\/]/).filter(Boolean).pop() ?? root, path: rootNorm }]
    let cursor = rootNorm
    for (const part of parts) {
      cursor = `${cursor}${sepChar}${part}`
      acc.push({ label: part, path: cursor })
    }
    return acc
  }

  return (
    <Show when={segments().length > 0}>
      <div class="h-6 shrink-0 flex items-center gap-1 px-3 border-b border-border-base bg-background-base text-xs text-text-muted overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <For each={segments()}>
          {(seg, i) => (
            <>
              <Show when={i() > 0}>
                <span class="text-text-faint shrink-0">›</span>
              </Show>
              <button
                type="button"
                class="shrink-0 hover:text-text-base truncate max-w-[200px]"
                classList={{ "text-text-base": i() === segments().length - 1 }}
                onClick={() => void ws.revealPath(seg.path)}
              >
                {seg.label}
              </button>
            </>
          )}
        </For>
      </div>
    </Show>
  )
}
