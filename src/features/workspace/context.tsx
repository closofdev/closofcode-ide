import { createSimpleContext } from "../../lib/simple-context"
import { createWorkspaceStore } from "./store"
import {
  createDir,
  createFile,
  deletePath,
  isTauri,
  readDir,
  readFile,
  renamePath,
  writeFile,
} from "../../lib/tauri"

export const { provider: WorkspaceProvider, use: useWorkspace } = createSimpleContext({
  name: "Workspace",
  init: () =>
    createWorkspaceStore({
      readDir: async (path) => (isTauri ? readDir(path) : []),
      readFile: async (path) => (isTauri ? readFile(path) : ""),
      writeFile: async (path, contents) => {
        if (isTauri) await writeFile(path, contents)
      },
      createFile: async (path) => {
        if (isTauri) await createFile(path)
      },
      createDir: async (path) => {
        if (isTauri) await createDir(path)
      },
      renamePath: async (from, to) => {
        if (isTauri) await renamePath(from, to)
      },
      deletePath: async (path) => {
        if (isTauri) await deletePath(path)
      },
    }),
})
