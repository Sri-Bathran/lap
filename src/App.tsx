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
  const [maximized, setMaximized] = useState(true)

  if (lap.autoUnlocking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="animate-pop-in rounded-xl bg-mac-surface-card px-4 py-2 text-sm text-mac-text-2 shadow-lg">
          Signing you in…
        </div>
      </div>
    )
  }

  if (!lap.unlocked) return <UnlockScreen />

  return (
    <div className={`flex h-screen w-screen items-center justify-center ${maximized ? '' : 'p-6'}`}>
      <div
        className={`finder-window animate-pop-in flex h-full w-full flex-col overflow-hidden bg-mac-surface-1 shadow-2xl ring-1 ring-mac-divider ${
          maximized ? 'max-w-none rounded-none' : 'max-w-[1400px] rounded-2xl'
        }`}
      >
        <div
          className="flex items-center gap-2 border-b border-mac-divider bg-mac-surface-2 px-4 py-2.5"
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
          <span className="ml-3 select-none text-[13px] font-medium text-mac-text-3">
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
