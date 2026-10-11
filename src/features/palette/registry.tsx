import { createSignal } from "solid-js"
import { createSimpleContext } from "../../lib/simple-context"

export interface Command {
  id: string
  title: string
  run: () => void
}

export function createCommandRegistry() {
  const [map, setMap] = createSignal(new Map<string, Command>())
  const list = () => [...map().values()].sort((a, b) => a.title.localeCompare(b.title))
  const register = (cmd: Command) => {
    setMap((prev) => {
      const next = new Map(prev)
      next.set(cmd.id, cmd)
      return next
    })
  }
  return { list, register }
}

export const { provider: CommandRegistryProvider, use: useCommandRegistry } = createSimpleContext({
  name: "CommandRegistry",
  init: () => createCommandRegistry(),
})
