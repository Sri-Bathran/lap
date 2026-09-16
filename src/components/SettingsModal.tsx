import { useRef, useState } from 'react'
import { X, Trash2, Upload } from 'lucide-react'
import { useTheme, WALLPAPER_PRESETS, ACCENT_PRESETS, type FontFamily, type FontSize, type ThemeMode } from '../state/theme'
import { useLap } from '../state/store'
import { compressImageToDataUrl } from '../lib/image'
import {
  loadCustomExtensions, addCustomExtension, removeCustomExtension,
  CATEGORY_LABELS, type ExtCategory,
} from '../lib/extensions'

const THEME_MODES: { id: ThemeMode; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
]
const FONT_FAMILIES: { id: FontFamily; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'mono', label: 'Monospace' },
]
const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
]
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as ExtCategory[]

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const theme = useTheme()
  const lap = useLap()
  const [customExt, setCustomExt] = useState<Record<string, ExtCategory>>(() => loadCustomExtensions())
  const [newExt, setNewExt] = useState('')
  const [newCategory, setNewCategory] = useState<ExtCategory>('code')
  const [wallpaperError, setWallpaperError] = useState<string | null>(null)
  const wallpaperInputRef = useRef<HTMLInputElement>(null)

  function handleAddExtension(e: React.FormEvent) {
    e.preventDefault()
    const ext = newExt.trim().toLowerCase().replace(/^\./, '')
    if (!ext) return
    setCustomExt(addCustomExtension(ext, newCategory))
    setNewExt('')
  }

  function handleRemoveExtension(ext: string) {
    setCustomExt(removeCustomExtension(ext))
  }

  function handleForgetToken() {
    const ok = window.confirm('Forget the saved token on this device? You\'ll need to paste it again next time.')
    if (ok) lap.forgetToken()
  }

  async function handleWallpaperFile(file: File | undefined) {
    if (!file) return
    setWallpaperError(null)
    try {
      const dataUrl = await compressImageToDataUrl(file)
      theme.setCustomWallpaper(dataUrl)
    } catch (err: any) {
      setWallpaperError(err?.message ?? 'Could not use that image.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-pop-in flex max-h-[85vh] w-[min(560px,92vw)] flex-col overflow-hidden rounded-2xl bg-mac-surface-solid shadow-2xl">
        <div className="flex items-center justify-between border-b border-mac-divider px-5 py-3">
          <h2 className="text-base font-semibold text-mac-text-1">Settings</h2>
          <button onClick={onClose} className="rounded-md p-1 text-mac-text-5 hover:bg-mac-surface-hover">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-4">
          {/* Appearance */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mac-text-4">Appearance</h3>
            <div className="flex gap-1 rounded-lg bg-mac-surface-muted p-1 text-xs">
              {THEME_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => theme.update({ mode: m.id })}
                  className={`flex-1 rounded-md py-1.5 font-medium ${theme.mode === m.id ? 'bg-mac-surface-solid shadow-sm text-mac-text-1' : 'text-mac-text-4'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          {/* Accent color */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mac-text-4">Accent color</h3>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => theme.update({ accent: c })}
                  className="h-7 w-7 rounded-full ring-offset-2 ring-offset-mac-surface-solid"
                  style={{ background: c, boxShadow: theme.accent === c ? `0 0 0 2px var(--color-mac-surface-solid), 0 0 0 4px ${c}` : undefined }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={theme.accent}
                onChange={(e) => theme.update({ accent: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-mac-border-input bg-transparent p-0.5"
                title="Custom color"
              />
            </div>
          </section>

          {/* Wallpaper */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mac-text-4">Wallpaper</h3>
            <p className="mb-2 text-[11px] text-mac-text-5">
              Presets, or upload your own — kept only in this browser, never in a volume.
            </p>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => wallpaperInputRef.current?.click()}
                className={`flex h-12 items-center justify-center rounded-lg border border-dashed border-mac-border-input text-mac-text-4 ring-offset-2 ring-offset-mac-surface-solid hover:text-mac-text-2 ${
                  theme.wallpaper === 'custom' ? 'ring-2 ring-mac-accent' : ''
                }`}
                style={theme.wallpaper === 'custom' && theme.customWallpaperDataUrl
                  ? { backgroundImage: `url(${theme.customWallpaperDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : undefined}
                title="Upload your own"
              >
                {!(theme.wallpaper === 'custom' && theme.customWallpaperDataUrl) && <Upload size={16} />}
              </button>
              {WALLPAPER_PRESETS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => theme.update({ wallpaper: w.id })}
                  className={`h-12 rounded-lg ring-offset-2 ring-offset-mac-surface-solid ${theme.wallpaper === w.id ? 'ring-2 ring-mac-accent' : ''}`}
                  style={{ background: w.css }}
                  title={w.label}
                />
              ))}
            </div>
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { handleWallpaperFile(e.target.files?.[0]); e.currentTarget.value = '' }}
            />
            {theme.customWallpaperDataUrl && (
              <button
                onClick={theme.clearCustomWallpaper}
                className="mt-2 text-[11px] text-mac-text-4 hover:text-mac-danger"
              >
                Remove uploaded wallpaper
              </button>
            )}
            {wallpaperError && <p className="mt-1 text-[11px] text-mac-danger">{wallpaperError}</p>}
          </section>

          {/* Typography */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mac-text-4">Typography</h3>
            <div className="mb-2 flex gap-1 rounded-lg bg-mac-surface-muted p-1 text-xs">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => theme.update({ fontFamily: f.id })}
                  className={`flex-1 rounded-md py-1.5 font-medium ${theme.fontFamily === f.id ? 'bg-mac-surface-solid shadow-sm text-mac-text-1' : 'text-mac-text-4'}`}
                  style={f.id === 'mono' ? { fontFamily: 'ui-monospace, monospace' } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-mac-surface-muted p-1 text-xs">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => theme.update({ fontSize: f.id })}
                  className={`flex-1 rounded-md py-1.5 font-medium ${theme.fontSize === f.id ? 'bg-mac-surface-solid shadow-sm text-mac-text-1' : 'text-mac-text-4'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {/* Upload precaution */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mac-text-4">Upload precautions</h3>
            <label className="flex items-start gap-2 text-sm text-mac-text-2">
              <input
                type="checkbox"
                checked={theme.warnOnMediaUpload}
                onChange={(e) => theme.update({ warnOnMediaUpload: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                Warn before uploading images or videos
                <span className="block text-[11px] text-mac-text-5">
                  Git keeps every version forever, so media quietly bloats repo size. Recommended on since this is mainly a code/notes drive.
                </span>
              </span>
            </label>
          </section>

          {/* Custom file extensions */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mac-text-4">File extensions</h3>
            <p className="mb-2 text-[11px] text-mac-text-5">
              Teach Lap how to icon/preview an extension it doesn't recognize yet.
            </p>
            <form onSubmit={handleAddExtension} className="mb-2 flex gap-2">
              <input
                value={newExt}
                onChange={(e) => setNewExt(e.target.value)}
                placeholder="e.g. nse, tfstate"
                className="w-32 rounded-lg border border-mac-border-input bg-transparent px-2.5 py-1.5 text-xs text-mac-text-1 outline-none focus:border-mac-accent"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ExtCategory)}
                className="flex-1 rounded-lg border border-mac-border-input bg-transparent px-2.5 py-1.5 text-xs text-mac-text-1 outline-none focus:border-mac-accent"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-mac-accent px-3 py-1.5 text-xs font-medium text-white hover:brightness-90">
                Add
              </button>
            </form>
            {Object.keys(customExt).length > 0 && (
              <div className="space-y-1">
                {Object.entries(customExt).map(([ext, cat]) => (
                  <div key={ext} className="flex items-center justify-between rounded-lg bg-mac-surface-row px-2.5 py-1.5 text-xs text-mac-text-2">
                    <span><code>.{ext}</code> → {CATEGORY_LABELS[cat]}</span>
                    <button onClick={() => handleRemoveExtension(ext)} className="text-mac-text-5 hover:text-mac-danger">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Device */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mac-text-4">This device</h3>
            <p className="mb-2 text-[11px] text-mac-text-5">
              Signed in as <strong>{lap.login}</strong>. Your token is remembered only in this browser.
            </p>
            <button
              onClick={handleForgetToken}
              className="rounded-lg border border-mac-danger/30 px-3 py-1.5 text-xs font-medium text-mac-danger hover:bg-mac-danger-bg"
            >
              Forget saved token on this device
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
