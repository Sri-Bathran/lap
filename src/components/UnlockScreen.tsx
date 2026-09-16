import { useState } from 'react'
import { useLap } from '../state/store'

export default function UnlockScreen() {
  const lap = useLap()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(lap.autoUnlockError)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setError(null)
    setBusy(true)
    try {
      await lap.unlockWithToken(token.trim())
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="finder-window animate-pop-in w-[420px] rounded-2xl bg-white/90 p-7 shadow-2xl"
      >
        <div className="mb-1 text-5xl">💻</div>
        <h1 className="mb-1 text-xl font-semibold text-gray-800">Welcome to Lap</h1>
        <p className="mb-5 text-sm text-gray-500">
          Your GitHub-backed drive. Files live in your private repos — Lap just makes them feel local.
        </p>

        {lap.autoUnlockError && !error && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            The token saved on this device no longer works — paste a fresh one below.
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            GitHub personal access token
          </label>
          <input
            type="password"
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-mac-accent focus:ring-2 focus:ring-mac-accent/20"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Classic token with the <code>repo</code> scope (fine-grained tokens can't create new repos).
            Remembered on this device only — paste it again on any other device you use.
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy || !token.trim()}
          className="w-full rounded-lg bg-mac-accent py-2 text-sm font-medium text-white transition hover:brightness-90 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect GitHub'}
        </button>
      </form>
    </div>
  )
}
