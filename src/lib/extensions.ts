// Single source of truth for "what kind of file is this": drives the icon,
// the preview modal's rendering path, and the media-upload precaution
// warning. Built-ins are weighted toward a scripting/security workflow;
// anything missing can be added per-device in Settings without touching code.

export type ExtCategory =
  | 'code' | 'shell' | 'config' | 'security' | 'json' | 'markdown' | 'text'
  | 'image' | 'video' | 'audio' | 'archive' | 'sheet' | 'db' | 'unknown'

const LS_KEY = 'lap.customExtensions'

const BUILTIN: Record<string, ExtCategory> = {
  // code
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code', py: 'code', go: 'code', rs: 'code',
  java: 'code', kt: 'code', c: 'code', cpp: 'code', h: 'code', hpp: 'code', cs: 'code',
  rb: 'code', php: 'code', lua: 'code', r: 'code', swift: 'code', html: 'code', css: 'code',
  scss: 'code', sql: 'code',
  // shell / scripting
  sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'shell', psm1: 'shell', psd1: 'shell',
  bat: 'shell', cmd: 'shell', fish: 'shell',
  // config / IaC
  yml: 'config', yaml: 'config', toml: 'config', ini: 'config', conf: 'config', cfg: 'config',
  env: 'config', tf: 'config', tfvars: 'config', dockerfile: 'config', xml: 'config',
  gitignore: 'config',
  // security / recon artifacts
  pcap: 'security', pcapng: 'security', yar: 'security', yara: 'security', sig: 'security',
  rules: 'security', nse: 'security',
  // structured / doc text
  json: 'json', md: 'markdown', markdown: 'markdown', txt: 'text', log: 'text', rtf: 'text',
  // media & binary
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  bmp: 'image', ico: 'image',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', m4a: 'audio', ogg: 'audio',
  zip: 'archive', tar: 'archive', gz: 'archive', rar: 'archive', '7z': 'archive', bz2: 'archive',
  xlsx: 'sheet', xls: 'sheet', csv: 'sheet', tsv: 'sheet',
  db: 'db', sqlite: 'db', sqlite3: 'db',
}

export function extOf(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower === 'dockerfile') return 'dockerfile'
  const dot = lower.lastIndexOf('.')
  return dot >= 0 ? lower.slice(dot + 1) : lower
}

export function loadCustomExtensions(): Record<string, ExtCategory> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveCustomExtensions(map: Record<string, ExtCategory>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(map))
}

export function addCustomExtension(ext: string, category: ExtCategory): Record<string, ExtCategory> {
  const map = loadCustomExtensions()
  map[ext.toLowerCase().replace(/^\./, '')] = category
  saveCustomExtensions(map)
  return map
}

export function removeCustomExtension(ext: string): Record<string, ExtCategory> {
  const map = loadCustomExtensions()
  delete map[ext]
  saveCustomExtensions(map)
  return map
}

export function categoryFor(filename: string): ExtCategory {
  const ext = extOf(filename)
  const custom = loadCustomExtensions()
  return custom[ext] ?? BUILTIN[ext] ?? 'unknown'
}

export const TEXT_CATEGORIES: ExtCategory[] = ['code', 'shell', 'config', 'security', 'json', 'text']
export const CATEGORY_LABELS: Record<ExtCategory, string> = {
  code: 'Code', shell: 'Shell / script', config: 'Config / IaC', security: 'Security artifact',
  json: 'JSON', markdown: 'Markdown', text: 'Plain text', image: 'Image', video: 'Video',
  audio: 'Audio', archive: 'Archive', sheet: 'Spreadsheet', db: 'Database', unknown: 'Unknown',
}

export function isTextLike(cat: ExtCategory): boolean {
  return TEXT_CATEGORIES.includes(cat)
}

export function isMedia(cat: ExtCategory): boolean {
  return cat === 'image' || cat === 'video'
}
