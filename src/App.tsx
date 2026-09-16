import { useState } from 'react'
import { useLap } from './state/store'
import UnlockScreen from './components/UnlockScreen'
import Sidebar from './components/Sidebar'
import Finder from './components/Finder'
import NewVolumeModal from './components/NewVolumeModal'
import SettingsModal from './components/SettingsModal'

export default function App() {
  const lap = useLap()
  const [showNewVolume, setShowNewVolume] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [maximized, setMaximized] = useState(false)

  if (lap.autoUnlocking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-white/80">
        <div className="animate-pop-in text-sm">Signing you in…</div>
      </div>
    )
  }

  if (!lap.unlocked) return <UnlockScreen />

  return (
    <div className={`flex h-screen w-screen items-center justify-center ${maximized ? '' : 'p-6'}`}>
      <div
        className={`finder-window animate-pop-in flex h-full w-full flex-col overflow-hidden bg-white/70 shadow-2xl ring-1 ring-black/10 ${
          maximized ? 'max-w-none rounded-none' : 'max-w-[1400px] rounded-2xl'
        }`}
      >
        <div
          className="flex items-center gap-2 border-b border-black/10 bg-white/50 px-4 py-2.5"
          onDoubleClick={() => setMaximized((m) => !m)}
        >
          <button
            title="Close (lock)"
            onClick={lap.lock}
            className="traffic-dot bg-[#ff5f57]"
          />
          <span title="Minimize" className="traffic-dot bg-[#febc2e]" />
          <button
            title={maximized ? 'Restore' : 'Maximize'}
            onClick={() => setMaximized((m) => !m)}
            className="traffic-dot bg-[#28c840]"
          />
          <span className="ml-3 select-none text-[13px] font-medium text-gray-600">
            {lap.activeVolume ? `${lap.activeVolume.repo} — Lap` : 'Lap'}
          </span>
        </div>
        <div className="flex min-h-0 flex-1">
          <Sidebar onNewVolume={() => setShowNewVolume(true)} onOpenSettings={() => setShowSettings(true)} />
          <Finder />
        </div>
      </div>
      {showNewVolume && <NewVolumeModal onClose={() => setShowNewVolume(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
