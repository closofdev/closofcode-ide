import { render } from "solid-js/web"
import { ThemeProvider } from "~ui/theme/context"
import { App } from "./app"
import { setupMonaco } from "./features/editor/monaco-setup"
import "./styles.css"

setupMonaco()

render(
  () => (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  ),
  document.getElementById("root")!,
)
