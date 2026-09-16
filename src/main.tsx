import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { LapProvider } from './state/store'
import { ThemeProvider, applyThemeCss, loadThemeSettings } from './state/theme'

// Apply saved theme synchronously before first paint to avoid a flash of
// the default look.
applyThemeCss(loadThemeSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LapProvider>
        <App />
      </LapProvider>
    </ThemeProvider>
  </StrictMode>,
)
