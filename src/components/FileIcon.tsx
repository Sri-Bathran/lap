import {
  Folder, FileText, FileImage, FileCode, FileArchive, FileAudio, FileVideo,
  FileSpreadsheet, FileJson, FileTerminal, ShieldAlert, Database, Settings,
  File as FileGeneric,
} from 'lucide-react'
import type { NodeType } from '../types'
import { categoryFor, type ExtCategory } from '../lib/extensions'

const ICON_BY_CATEGORY: Record<ExtCategory, { Icon: typeof FileGeneric; color: string }> = {
  code: { Icon: FileCode, color: '#8b5cf6' },
  shell: { Icon: FileTerminal, color: '#111827' },
  config: { Icon: Settings, color: '#78716c' },
  security: { Icon: ShieldAlert, color: '#dc2626' },
  json: { Icon: FileJson, color: '#e0a63e' },
  markdown: { Icon: FileText, color: '#2563eb' },
  text: { Icon: FileText, color: '#64748b' },
  image: { Icon: FileImage, color: '#22c55e' },
  video: { Icon: FileVideo, color: '#ef4444' },
  audio: { Icon: FileAudio, color: '#ec4899' },
  archive: { Icon: FileArchive, color: '#a3703a' },
  sheet: { Icon: FileSpreadsheet, color: '#16a34a' },
  db: { Icon: Database, color: '#0891b2' },
  unknown: { Icon: FileGeneric, color: '#94a3b8' },
}

function iconFor(name: string, type: NodeType) {
  if (type === 'folder') return { Icon: Folder, color: '#5b9bf5' }
  return ICON_BY_CATEGORY[categoryFor(name)]
}

export default function FileIcon({ name, type, size = 40 }: { name: string; type: NodeType; size?: number }) {
  const { Icon, color } = iconFor(name, type)
  return <Icon size={size} color={color} strokeWidth={1.5} fill={type === 'folder' ? color : 'none'} fillOpacity={type === 'folder' ? 0.15 : 0} />
}
