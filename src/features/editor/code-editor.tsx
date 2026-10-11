import * as monaco from "monaco-editor"
import { createEffect, onCleanup, onMount } from "solid-js"

export interface EditorProps {
  value: string
  language: string
  theme?: "dark" | "light"
  onChange?: (value: string) => void
  onSave?: () => void
}

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
      fontSize: 14,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      tabSize: 2,
      padding: { top: 12 },
      smoothScrolling: true,
      cursorBlinking: "smooth",
    })

    editor.onDidChangeModelContent(() => {
      if (applyingExternal) return
      props.onChange?.(editor!.getValue())
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      props.onSave?.()
    })
  })

  onCleanup(() => editor?.dispose())

  // push external value changes (e.g. file switch) into the editor
  createEffect(() => {
    const value = props.value
    if (!editor) return
    if (editor.getValue() === value) return
    applyingExternal = true
    const pos = editor.getPosition()
    editor.setValue(value)
    if (pos) editor.setPosition(pos)
    applyingExternal = false
  })

  createEffect(() => {
    const model = editor?.getModel()
    if (model) monaco.editor.setModelLanguage(model, props.language)
  })

  createEffect(() => {
    monaco.editor.setTheme(props.theme === "light" ? "vs" : "opencode-dark")
  })

  return <div ref={host} class="h-full w-full" />
}
