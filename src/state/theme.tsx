import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type FontFamily = 'system' | 'rounded' | 'mono'
export type FontSize = 'small' | 'medium' | 'large'

export interface ThemeSettings {
  accent: string
  wallpaper: string // preset id, see WALLPAPER_PRESETS
  fontFamily: FontFamily
  fontSize: FontSize
  warnOnMediaUpload: boolean
}

// Presets only — deliberately no custom image upload for wallpaper, since
// the whole point is keeping media out of your volumes.
export const WALLPAPER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: 'ocean', label: 'Ocean', css: 'linear-gradient(160deg, #6f9fd8 0%, #4d6fa6 45%, #33477a 100%)' },
  { id: 'midnight', label: 'Midnight', css: 'linear-gradient(160deg, #232526 0%, #414345 100%)' },
  { id: 'terminal', label: 'Terminal', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'forest', label: 'Forest', css: 'linear-gradient(160deg, #5a7d5a 0%, #2e4a2e 100%)' },
  { id: 'sunset', label: 'Sunset', css: 'linear-gradient(160deg, #f6a56f 0%, #a3577a 60%, #3a3a6a 100%)' },
  { id: 'graphite', label: 'Graphite', css: 'linear-gradient(160deg, #7c8797 0%, #3c4450 100%)' },
  { id: 'mono', label: 'Plain gray', css: '#dfe1e6' },
]

const ACCENT_PRESETS = ['#0a84ff', '#30d158', '#ff453a', '#ff9f0a', '#bf5af2', '#64d2ff', '#ffd60a']

const FONT_STACKS: Record<FontFamily, string> = {
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif',
  rounded: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "Cascadia Code", "Consolas", "SFMono-Regular", Menlo, monospace',
}

const FONT_SIZE_PX: Record<FontSize, string> = {
  small: '12.5px',
  medium: '14px',
  large: '16px',
}

const LS_KEY = 'lap.settings'

const DEFAULTS: ThemeSettings = {
  accent: '#0a84ff',
  wallpaper: 'ocean',
  fontFamily: 'system',
  fontSize: 'medium',
  warnOnMediaUpload: true,
}

export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function applyThemeCss(t: ThemeSettings): void {
  const root = document.documentElement
  root.style.setProperty('--color-mac-accent', t.accent)
  root.style.setProperty('--font-sans', FONT_STACKS[t.fontFamily])
  root.style.setProperty('--ui-font-size', FONT_SIZE_PX[t.fontSize])
  const preset = WALLPAPER_PRESETS.find((w) => w.id === t.wallpaper)
  root.style.setProperty('--wallpaper', preset ? preset.css : WALLPAPER_PRESETS[0].css)
}

export { ACCENT_PRESETS }

interface ThemeState extends ThemeSettings {
  update: (patch: Partial<ThemeSettings>) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(() => loadThemeSettings())

  useEffect(() => {
    applyThemeCss(settings)
  }, [settings])

  const update = useCallback((patch: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return <ThemeContext.Provider value={{ ...settings, update }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
