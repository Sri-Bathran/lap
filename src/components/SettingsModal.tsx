import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useTheme, WALLPAPER_PRESETS, ACCENT_PRESETS, type FontFamily, type FontSize } from '../state/theme'
import { useLap } from '../state/store'
import {
  loadCustomExtensions, addCustomExtension, removeCustomExtension,
  CATEGORY_LABELS, type ExtCategory,
} from '../lib/extensions'

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-pop-in flex max-h-[85vh] w-[min(560px,92vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-800">Settings</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-4">
          {/* Accent color */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Accent color</h3>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => theme.update({ accent: c })}
                  className="h-7 w-7 rounded-full ring-offset-2"
                  style={{ background: c, boxShadow: theme.accent === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={theme.accent}
                onChange={(e) => theme.update({ accent: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-transparent p-0.5"
                title="Custom color"
              />
            </div>
          </section>

          {/* Wallpaper */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Wallpaper</h3>
            <p className="mb-2 text-[11px] text-gray-400">
              Presets only — keeping images out of your volumes on purpose.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {WALLPAPER_PRESETS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => theme.update({ wallpaper: w.id })}
                  className={`h-12 rounded-lg ring-offset-2 ${theme.wallpaper === w.id ? 'ring-2 ring-mac-accent' : ''}`}
                  style={{ background: w.css }}
                  title={w.label}
                />
              ))}
            </div>
          </section>

          {/* Typography */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Typography</h3>
            <div className="mb-2 flex gap-1 rounded-lg bg-gray-100 p-1 text-xs">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => theme.update({ fontFamily: f.id })}
                  className={`flex-1 rounded-md py-1.5 font-medium ${theme.fontFamily === f.id ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                  style={f.id === 'mono' ? { fontFamily: 'ui-monospace, monospace' } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => theme.update({ fontSize: f.id })}
                  className={`flex-1 rounded-md py-1.5 font-medium ${theme.fontSize === f.id ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {/* Upload precaution */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Upload precautions</h3>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={theme.warnOnMediaUpload}
                onChange={(e) => theme.update({ warnOnMediaUpload: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                Warn before uploading images or videos
                <span className="block text-[11px] text-gray-400">
                  Git keeps every version forever, so media quietly bloats repo size. Recommended on since this is mainly a code/notes drive.
                </span>
              </span>
            </label>
          </section>

          {/* Custom file extensions */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">File extensions</h3>
            <p className="mb-2 text-[11px] text-gray-400">
              Teach Lap how to icon/preview an extension it doesn't recognize yet.
            </p>
            <form onSubmit={handleAddExtension} className="mb-2 flex gap-2">
              <input
                value={newExt}
                onChange={(e) => setNewExt(e.target.value)}
                placeholder="e.g. nse, tfstate"
                className="w-32 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-mac-accent"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ExtCategory)}
                className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-mac-accent"
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
                  <div key={ext} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs">
                    <span><code>.{ext}</code> → {CATEGORY_LABELS[cat]}</span>
                    <button onClick={() => handleRemoveExtension(ext)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Device */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">This device</h3>
            <p className="mb-2 text-[11px] text-gray-400">
              Signed in as <strong>{lap.login}</strong>. Your token is remembered only in this browser.
            </p>
            <button
              onClick={handleForgetToken}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              Forget saved token on this device
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
