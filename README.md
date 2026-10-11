# closofcode-ide

A desktop code editor built with Tauri and SolidJS. The interface — theme,
colors, file tree styling, icons, fonts — is taken from
[opencode](https://github.com/anomalyco/opencode)'s design system. There are no
AI or agent features; this is a plain editor.

## Why

Most "AI IDE" projects are an agent with an editor bolted on. This one is the
opposite: a normal editor that happens to look like opencode.

## Stack

- **Shell**: Tauri 2 (Rust), uses the OS webview — WebView2 on Windows, WebKit on macOS
- **Frontend**: SolidJS, Vite, Tailwind v4
- **Editor**: Monaco
- **Terminal**: portable-pty (Rust) → xterm.js
- **Theme/components**: vendored from opencode's `packages/ui`

## Features

- File explorer: open a folder, lazy-loaded tree, file-type icons, right-click
  to create or delete files and folders, git status markers (M/A/D/U)
- Editor: open and save files, multiple tabs, unsaved-change indicator, syntax
  highlighting for the languages Monaco ships, find (`Ctrl+F`), per-file cursor
  and scroll restore
- Tab strip: horizontal scroll, a clear active indicator, middle-click to close,
  and a dropdown listing every open tab
- Integrated terminal (PowerShell on Windows)
- Command palette: `Ctrl+P` to search files, `Ctrl+Shift+P` for commands
- Theme picker with the opencode theme set

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+P` | Search files |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+S` | Save file |
| `Ctrl+F` | Find in file |
| `` Ctrl+` `` | Toggle terminal |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+wheel` | Zoom editor |
| `Enter` / `Space` | Open a focused tree item |
| Middle click | Close a tab |

## Project layout

```
src/                     SolidJS app
  features/
    layout/              3-panel shell
    file-tree/           file explorer
    editor/              Monaco wrapper and theme
    tabs/                tab strip
    terminal/            xterm and pty bridge
    palette/             command palette and registry
    workspace/           workspace state
  lib/                   tauri bridge, helpers
vendor/ui/               vendored opencode design system
src-tauri/               Rust shell
  src/fs_ops.rs          file read/write/create/delete
  src/git.rs             git status for the tree
  src/watch.rs           filesystem watcher
  src/pty.rs             terminal pty
```

## Prerequisites

- [Bun](https://bun.sh)
- [Rust](https://rustup.rs) with the MSVC toolchain (on Windows)
- Visual Studio C++ Build Tools (on Windows)
- WebView2 runtime (on Windows, usually preinstalled)

## Development

```bash
bun install
bun run tauri dev
```

To work on the UI in a browser (no filesystem or terminal, since those need the
Tauri shell):

```bash
bun run dev   # http://localhost:4444
```

## Build

```bash
bun run tauri build
```

The installer is written to `src-tauri/target/release/bundle/`.

## Notes

- The theme tokens, colors, and file-tree CSS are byte-identical to opencode.
  The editor and terminal are not. opencode ships no typing editor (it uses a
  diff viewer for review), so Monaco and xterm.js are used here instead.

## License

MIT. Theme and UI components derived from opencode (MIT).
