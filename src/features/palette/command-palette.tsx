import { createSignal, For, Show, onCleanup, onMount } from "solid-js"
import fuzzysort from "fuzzysort"
import { useWorkspace } from "../workspace/context"
import { useCommandRegistry } from "./registry"

export function CommandPalette() {
  const ws = useWorkspace()
  const commands = useCommandRegistry()
  const [open, setOpen] = createSignal(false)
  const [mode, setMode] = createSignal<"files" | "commands">("files")
  const [query, setQuery] = createSignal("")
  const [index, setIndex] = createSignal(0)
  let input: HTMLInputElement | undefined

  const allFiles = () => Object.keys(ws.state.nodes).filter((p) => ws.node(p)?.type === "file")

  const results = () => {
    if (mode() === "commands") {
      const q = query().replace(/^>/, "").trim()
      const list = commands.list()
      if (!q) return list.map((c) => ({ id: c.id, label: c.title, run: c.run }))
      return fuzzysort
        .go(q, list, { key: "title" })
        .map((r) => ({ id: r.obj.id, label: r.obj.title, run: r.obj.run }))
    }
    const q = query().trim()
    const files = allFiles()
    if (!q) return files.slice(0, 100).map((f) => ({ id: f, label: f, run: () => void ws.openFile(f) }))
    return fuzzysort
      .go(q, files)
      .slice(0, 100)
      .map((r) => ({ id: r.target, label: r.target, run: () => void ws.openFile(r.target) }))
  }

  const openPalette = (m: "files" | "commands") => {
    setMode(m)
    setOpen(true)
    setQuery(m === "commands" ? ">" : "")
    setIndex(0)
    queueMicrotask(() => input?.focus())
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault()
        openPalette("commands")
        return
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault()
        openPalette("files")
        return
      }
      if (!open()) return
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, results().length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        const item = results()[index()]
        if (item) {
          item.run()
          setOpen(false)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <Show when={open()}>
      <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
        onClick={() => setOpen(false)}
      >
        <div
          class="w-[600px] max-w-[90vw] bg-background-strong border border-border-base rounded-lg shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={input}
            class="w-full bg-transparent px-4 py-3 text-sm outline-none border-b border-border-base"
            placeholder={mode() === "commands" ? "> Type a command" : "Search files by name"}
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value)
              setIndex(0)
            }}
          />
          <div class="max-h-[45vh] overflow-auto py-1">
            <Show when={results().length > 0} fallback={<div class="px-4 py-3 text-sm text-text-faint">No results</div>}>
              <For each={results()}>
                {(item, i) => (
                  <div
                    class="px-4 py-1.5 text-sm cursor-pointer truncate"
                    classList={{
                      "bg-[var(--v2-overlay-simple-overlay-pressed)] text-text-base": i() === index(),
                      "text-text-muted": i() !== index(),
                    }}
                    onMouseEnter={() => setIndex(i())}
                    onClick={() => {
                      item.run()
                      setOpen(false)
                    }}
                  >
                    {item.label}
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
