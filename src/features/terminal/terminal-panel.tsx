import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { onCleanup, onMount } from "solid-js"
import { isTauri, onPtyExit, onPtyOutput, ptyClose, ptyOpen, ptyResize, ptyWrite } from "../../lib/tauri"

export interface TerminalPanelProps {
  cwd?: string | null
}

export function TerminalPanel(props: TerminalPanelProps) {
  let host: HTMLDivElement | undefined
  let term: Terminal | undefined
  let fit: FitAddon | undefined
  let ptyId = 0

  onMount(async () => {
    if (!host) return
    term = new Terminal({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: "#080808",
        foreground: "#e6e6e6",
        cursor: "#e6e6e6",
        selectionBackground: "#2a2a2a",
      },
    })
    fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()

    if (!isTauri) {
      term.writeln("Terminal runs inside the Tauri shell (Fase 4).")
      return
    }

    ptyId = await ptyOpen(props.cwd ?? null, term.cols, term.rows)

    onPtyOutput((out) => {
      if (out.id === ptyId) term!.write(out.data)
    })
    onPtyExit((id) => {
      if (id === ptyId) term!.writeln("\r\n[process exited]")
    })

    term.onData((data) => void ptyWrite(ptyId, data))

    const ro = new ResizeObserver(() => {
      fit!.fit()
      if (ptyId) void ptyResize(ptyId, term!.cols, term!.rows)
    })
    ro.observe(host)
    onCleanup(() => ro.disconnect())
  })

  onCleanup(() => {
    if (ptyId) void ptyClose(ptyId)
    term?.dispose()
  })

  return <div ref={host} class="h-full w-full p-2" />
}
