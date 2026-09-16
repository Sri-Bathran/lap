import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLap } from '../state/store'

export default function NewVolumeModal({ onClose }: { onClose: () => void }) {
  const lap = useLap()
  const [tab, setTab] = useState<'create' | 'attach'>('create')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<{ name: string; owner: { login: string }; default_branch: string }[] | null>(null)

  useEffect(() => {
    if (tab === 'attach' && existing === null && lap.client) {
      lap.client.listPrivateRepos().then(setExisting).catch((e) => setError(String(e?.message ?? e)))
    }
  }, [tab, existing, lap.client])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await lap.createVolume(name.trim())
      onClose()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  function attach(owner: string, repo: string, defaultBranch: string) {
    lap.addExistingVolume(owner, repo, defaultBranch)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-pop-in w-[420px] rounded-2xl bg-mac-surface-solid p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-mac-text-1">Mount a volume</h2>
          <button onClick={onClose} className="rounded-md p-1 text-mac-text-5 hover:bg-mac-surface-hover">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-mac-surface-muted p-1 text-xs">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 rounded-md py-1.5 font-medium ${tab === 'create' ? 'bg-mac-surface-solid shadow-sm' : 'text-mac-text-4'}`}
          >
            New volume
          </button>
          <button
            onClick={() => setTab('attach')}
            className={`flex-1 rounded-md py-1.5 font-medium ${tab === 'attach' ? 'bg-mac-surface-solid shadow-sm' : 'text-mac-text-4'}`}
          >
            Attach existing repo
          </button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate}>
            <label className="mb-1 block text-xs font-medium text-mac-text-3">Volume name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="lap-vol-personal"
              className="mb-1 w-full rounded-lg border border-mac-border-input px-3 py-2 text-sm outline-none focus:border-mac-accent focus:ring-2 focus:ring-mac-accent/20"
            />
            <p className="mb-3 text-[11px] text-mac-text-5">
              Creates a new <strong>private</strong> GitHub repo and mounts it as a drive. Keep each volume under ~5GB — spin up another when one fills up.
            </p>
            {error && <div className="mb-3 rounded-lg bg-mac-danger-bg px-3 py-2 text-xs text-mac-danger">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-mac-accent py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create & mount'}
            </button>
          </form>
        ) : (
          <div>
            {error && <div className="mb-3 rounded-lg bg-mac-danger-bg px-3 py-2 text-xs text-mac-danger">{error}</div>}
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {existing === null && <div className="py-6 text-center text-xs text-mac-text-5">Loading your repos…</div>}
              {existing?.length === 0 && <div className="py-6 text-center text-xs text-mac-text-5">No private repos found.</div>}
              {existing?.map((r) => {
                const already = lap.volumes.some((v) => v.owner === r.owner.login && v.repo === r.name)
                return (
                  <button
                    key={`${r.owner.login}/${r.name}`}
                    disabled={already}
                    onClick={() => attach(r.owner.login, r.name, r.default_branch)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-mac-surface-hover disabled:opacity-40"
                  >
                    <span className="truncate">{r.owner.login}/{r.name}</span>
                    {already && <span className="text-[10px] text-mac-text-5">mounted</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
