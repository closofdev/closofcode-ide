import * as monaco from "monaco-editor"
import { createEffect, onCleanup, onMount } from "solid-js"

export interface EditorViewState {
  cursorLine: number
  cursorColumn: number
  scrollTop: number
}

export interface EditorProps {
  path: string
  value: string
  language: string
  theme?: "dark" | "light"
  onChange?: (value: string) => void
  onSave?: () => void
  onViewChange?: (view: EditorViewState) => void
  initialView?: EditorViewState
}

const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 40

function defineThemes() {
  monaco.editor.defineTheme("opencode-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a737d", fontStyle: "italic" },
      { token: "keyword", foreground: "ff7b72" },
      { token: "string", foreground: "a5d6ff" },
      { token: "number", foreground: "79c0ff" },
      { token: "type", foreground: "ffa657" },
      { token: "function", foreground: "d2a8ff" },
      { token: "variable", foreground: "c9d1d9" },
    ],
    colors: {
      "editor.background": "#080808",
      "editor.foreground": "#e6e6e6",
      "editorLineNumber.foreground": "#4b4b4b",
      "editorLineNumber.activeForeground": "#9b9b9b",
      "editor.selectionBackground": "#2a2a2a",
      "editor.lineHighlightBackground": "#121212",
      "editorCursor.foreground": "#e6e6e6",
      "editorIndentGuide.background1": "#1d1d1d",
      "editorWidget.background": "#141414",
      "editorWidget.border": "#262626",
    },
  })
}

let fontSize = 14

/** Persisted per-editor view state, keyed by file path, so switching tabs
 *  restores cursor and scroll position instead of jumping to the top. */
const viewStore = new Map<string, EditorViewState>()

export function CodeEditor(props: EditorProps) {
  let host: HTMLDivElement | undefined
  let editor: monaco.editor.IStandaloneCodeEditor | undefined
  let applyingExternal = false

  onMount(() => {
    if (!host) return
    defineThemes()

    editor = monaco.editor.create(host, {
      value: props.value,
      language: props.language,
      theme: props.theme === "light" ? "vs" : "opencode-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      tabSize: 2,
      padding: { top: 12 },
      smoothScrolling: true,
      cursorBlinking: "smooth",
      find: { autoFindInSelection: "never" },
    })

    applyView(props.initialView ?? viewStore.get(props.path))

    editor.onDidChangeModelContent(() => {
      if (applyingExternal) return
      props.onChange?.(editor!.getValue())
    })

    editor.onDidChangeCursorPosition(() => saveView())
    editor.onDidScrollChange((e) => {
      if (e.scrollTopChanged) saveView()
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      props.onSave?.()
    })

    // Ctrl+F: open Monaco's built-in find widget.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor!.getAction?.("actions.find")?.run()
    })
  })

  function saveView() {
    if (!editor) return
    const pos = editor.getPosition()
    const view: EditorViewState = {
      cursorLine: pos?.lineNumber ?? 1,
      cursorColumn: pos?.column ?? 1,
      scrollTop: editor.getScrollTop(),
    }
    viewStore.set(props.path, view)
    props.onViewChange?.(view)
  }

  function applyView(view?: EditorViewState) {
    if (!editor) return
    if (view) {
      editor.setPosition({ lineNumber: view.cursorLine, column: view.cursorColumn })
      editor.setScrollTop(view.scrollTop)
    } else {
      editor.setPosition({ lineNumber: 1, column: 1 })
      editor.setScrollTop(0)
    }
  }

  onCleanup(() => editor?.dispose())

  // push external value changes (e.g. file switch) into the editor
  createEffect(() => {
    const value = props.value
    if (!editor) return
    if (editor.getValue() === value) return
    applyingExternal = true
    editor.setValue(value)
    applyingExternal = false
  })

  createEffect(() => {
    const model = editor?.getModel()
    if (model) monaco.editor.setModelLanguage(model, props.language)
  })

  createEffect(() => {
    monaco.editor.setTheme(props.theme === "light" ? "vs" : "opencode-dark")
  })

  const onWheelZoom = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    fontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize + (e.deltaY < 0 ? 1 : -1)))
    editor?.updateOptions({ fontSize })
  }

  return <div ref={host} class="h-full w-full" onWheel={onWheelZoom} />
}
