import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type FontFamily = 'system' | 'rounded' | 'mono'
export type FontSize = 'small' | 'medium' | 'large'
export type ThemeMode = 'light' | 'dark'

export interface ThemeSettings {
  mode: ThemeMode
  accent: string
  wallpaper: string // preset id, or 'custom' to use customWallpaperDataUrl
  fontFamily: FontFamily
  fontSize: FontSize
  warnOnMediaUpload: boolean
}

// Presets only for built-ins — plus one "custom" slot (Settings → upload)
// stored separately since it's a data URL, not a small string.
export const WALLPAPER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: 'nebula', label: 'Nebula', css: 'linear-gradient(160deg, #7f1d3f 0%, #3b1f5c 45%, #101a3d 100%)' },
  { id: 'crimson-tide', label: 'Crimson Tide', css: 'linear-gradient(160deg, #8b1e3f 0%, #1e2a78 100%)' },
  { id: 'ocean', label: 'Ocean', css: 'linear-gradient(160deg, #6f9fd8 0%, #4d6fa6 45%, #33477a 100%)' },
  { id: 'midnight', label: 'Midnight', css: 'linear-gradient(160deg, #232526 0%, #414345 100%)' },
  { id: 'terminal', label: 'Terminal', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'forest', label: 'Forest', css: 'linear-gradient(160deg, #5a7d5a 0%, #2e4a2e 100%)' },
  { id: 'graphite', label: 'Graphite', css: 'linear-gradient(160deg, #7c8797 0%, #3c4450 100%)' },
  { id: 'mono', label: 'Plain gray', css: '#dfe1e6' },
]

const ACCENT_PRESETS = ['#0a84ff', '#ff453a', '#30d158', '#ff9f0a', '#bf5af2', '#64d2ff', '#ffd60a']

const FONT_STACKS: Record<FontFamily, string> = {
  // -apple-system/BlinkMacSystemFont resolve to real SF Pro on Mac/iOS only;
  // Inter is the fallback everyone else gets, metrically close to SF Pro.
  system: '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif',
  rounded: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "Cascadia Code", "Consolas", "SFMono-Regular", Menlo, monospace',
}

// macOS system UI text sizes (Finder/sidebar default to 13px).
const FONT_SIZE_PX: Record<FontSize, string> = {
  small: '11px',
  medium: '13px',
  large: '15px',
}

const LS_KEY = 'lap.settings'
const LS_CUSTOM_WALLPAPER_KEY = 'lap.wallpaperCustom'

const DEFAULTS: ThemeSettings = {
  mode: 'dark',
  accent: '#0a84ff',
  wallpaper: 'nebula',
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

function loadCustomWallpaper(): string | null {
  try {
    return localStorage.getItem(LS_CUSTOM_WALLPAPER_KEY)
  } catch {
    return null
  }
}

export function applyThemeCss(t: ThemeSettings): void {
  const root = document.documentElement
  root.setAttribute('data-theme', t.mode)
  root.style.setProperty('--color-mac-accent', t.accent)
  root.style.setProperty('--font-sans', FONT_STACKS[t.fontFamily])
  root.style.setProperty('--ui-font-size', FONT_SIZE_PX[t.fontSize])
  if (t.wallpaper === 'custom') {
    const dataUrl = loadCustomWallpaper()
    root.style.setProperty('--wallpaper', dataUrl ? `url("${dataUrl}") center / cover no-repeat fixed` : WALLPAPER_PRESETS[0].css)
  } else {
    const preset = WALLPAPER_PRESETS.find((w) => w.id === t.wallpaper)
    root.style.setProperty('--wallpaper', preset ? preset.css : WALLPAPER_PRESETS[0].css)
  }
}

export { ACCENT_PRESETS }

interface ThemeState extends ThemeSettings {
  customWallpaperDataUrl: string | null
  update: (patch: Partial<ThemeSettings>) => void
  setCustomWallpaper: (dataUrl: string) => void
  clearCustomWallpaper: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(() => loadThemeSettings())
  const [customWallpaperDataUrl, setCustomWallpaperDataUrl] = useState<string | null>(() => loadCustomWallpaper())

  useEffect(() => {
    applyThemeCss(settings)
  }, [settings, customWallpaperDataUrl])

  const update = useCallback((patch: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setCustomWallpaper = useCallback((dataUrl: string) => {
    try {
      localStorage.setItem(LS_CUSTOM_WALLPAPER_KEY, dataUrl)
    } catch {
      // localStorage quota exceeded — the image was too large even after
      // client-side compression; fall back silently to the last wallpaper.
      return
    }
    setCustomWallpaperDataUrl(dataUrl)
    update({ wallpaper: 'custom' })
  }, [update])

  const clearCustomWallpaper = useCallback(() => {
    localStorage.removeItem(LS_CUSTOM_WALLPAPER_KEY)
    setCustomWallpaperDataUrl(null)
    if (settings.wallpaper === 'custom') update({ wallpaper: DEFAULTS.wallpaper })
  }, [settings.wallpaper, update])

  return (
    <ThemeContext.Provider value={{ ...settings, customWallpaperDataUrl, update, setCustomWallpaper, clearCustomWallpaper }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
