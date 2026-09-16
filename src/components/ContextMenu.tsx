import { useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  separatorAfter?: boolean
}

export default function ContextMenu({
  x, y, items, onClose,
}: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const clampedX = Math.min(x, window.innerWidth - 200)
  const clampedY = Math.min(y, window.innerHeight - items.length * 30 - 16)

  return (
    <div
      ref={ref}
      style={{ left: clampedX, top: clampedY }}
      className="animate-pop-in fixed z-50 min-w-[190px] rounded-xl bg-white/95 py-1.5 shadow-2xl ring-1 ring-black/10 backdrop-blur"
    >
      {items.map((item, i) => (
        <div key={i}>
          <button
            disabled={item.disabled}
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className={`block w-full px-3.5 py-1.5 text-left text-[13px] disabled:opacity-30 ${
              item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-mac-accent hover:text-white'
            }`}
          >
            {item.label}
          </button>
          {item.separatorAfter && <div className="my-1 h-px bg-gray-200" />}
        </div>
      ))}
    </div>
  )
}
