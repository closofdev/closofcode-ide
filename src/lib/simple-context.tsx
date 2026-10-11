import { createContext, useContext, type Accessor, type ParentProps } from "solid-js"

export function createSimpleContext<T, Props extends Record<string, any>>(input: {
  name: string
  init: ((input: Props) => T) | (() => T)
}) {
  const ctx = createContext<T>()

  return {
    provider: (props: ParentProps<Props>) => {
      const value = (input.init as (input: Props) => T)(props)
      return <ctx.Provider value={value}>{props.children}</ctx.Provider>
    },
    use(): T {
      const value = useContext(ctx)
      if (!value) throw new Error(`${input.name} context must be used within a context provider`)
      return value
    },
  }
}

export type { Accessor }
