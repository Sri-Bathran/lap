import { HardDrive, Plus, Lock, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import { useLap } from '../state/store'
import type { Volume } from '../types'

export default function Sidebar({ onNewVolume, onOpenSettings }: { onNewVolume: () => void; onOpenSettings: () => void }) {
  const lap = useLap()

  return (
    <div className="flex h-full w-56 flex-col border-r border-mac-divider bg-mac-surface-3 px-2 py-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-mac-text-4">Volumes</span>
        <button
          onClick={onNewVolume}
          title="New volume"
          className="rounded-md p-1 text-mac-text-4 hover:bg-mac-surface-hover"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {lap.volumes.length === 0 && (
          <div className="px-2 py-4 text-xs text-mac-text-5">
            No volumes yet. Click + to mount a repo as a drive.
          </div>
        )}
        {lap.volumes.map((v) => (
          <VolumeRow key={`${v.owner}/${v.repo}`} v={v} active={lap.activeVolume?.repo === v.repo && lap.activeVolume?.owner === v.owner} onClick={() => lap.selectVolume(v)} />
        ))}
      </div>

      <div className="mt-2 border-t border-mac-divider pt-2">
        {lap.activeVolume && (
          <button
            onClick={() => lap.refreshTree()}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-mac-text-3 hover:bg-mac-surface-hover"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        )}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="truncate text-xs text-mac-text-4">{lap.login}</span>
          <div className="flex items-center gap-0.5">
            <button onClick={onOpenSettings} title="Settings" className="rounded-md p-1 text-mac-text-4 hover:bg-mac-surface-hover">
              <SettingsIcon size={13} />
            </button>
            <button onClick={lap.lock} title="Lock" className="rounded-md p-1 text-mac-text-4 hover:bg-mac-surface-hover">
              <Lock size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VolumeRow({ v, active, onClick }: { v: Volume; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition ${
        active ? 'bg-mac-accent text-white' : 'text-mac-text-2 hover:bg-mac-surface-hover'
      }`}
    >
      <HardDrive size={15} className={active ? 'text-white' : 'text-mac-text-5'} />
      <span className="truncate">{v.repo}</span>
    </button>
  )
}
