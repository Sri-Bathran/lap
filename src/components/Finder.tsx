import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight, Upload, FolderPlus, Download, Trash2, RotateCw, Grid3x3, List as ListIcon,
  Copy, Scissors, ClipboardPaste,
} from 'lucide-react'
import { useLap } from '../state/store'
import { useTheme } from '../state/theme'
import { findNode, nodeSize } from '../lib/github'
import { categoryFor, isMedia } from '../lib/extensions'
import type { FsNode } from '../types'
import FileIcon from './FileIcon'
import ContextMenu, { type MenuItem } from './ContextMenu'
import PreviewModal from './PreviewModal'
import { downloadFile, downloadFolderAsZip, downloadSelectionAsZip } from '../lib/zip'
import { fileToBase64, formatBytes } from '../lib/binary'

const DND_MIME = 'application/x-lap-node-paths'

export default function Finder() {
  const lap = useLap()
  const theme = useTheme()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [previewNode, setPreviewNode] = useState<FsNode | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const current = lap.tree ? findNode(lap.tree, lap.path) : undefined
  const items = useMemo(() => {
    if (!current?.children) return []
    return [...current.children.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [current])

  const crumbs = useMemo(() => {
    const parts = lap.path ? lap.path.split('/') : []
    const out: { label: string; path: string }[] = [{ label: lap.activeVolume?.repo ?? 'Volume', path: '' }]
    let acc = ''
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p
      out.push({ label: p, path: acc })
    }
    return out
  }, [lap.path, lap.activeVolume])

  const selectedNodes = useMemo(
    () => (lap.tree ? [...lap.selected].map((p) => findNode(lap.tree!, p)).filter(Boolean) as FsNode[] : []),
    [lap.tree, lap.selected],
  )
  const totalSize = useMemo(() => items.reduce((s, n) => s + nodeSize(n), 0), [items])
  const selectedSize = useMemo(() => selectedNodes.reduce((s, n) => s + nodeSize(n), 0), [selectedNodes])

  const clipboardOwnsSelection = (path: string) =>
    lap.clipboard?.mode === 'cut' &&
    lap.clipboard.volume.owner === lap.activeVolume?.owner &&
    lap.clipboard.volume.repo === lap.activeVolume?.repo &&
    lap.clipboard.paths.includes(path)

  const canPaste =
    !!lap.clipboard &&
    lap.clipboard.volume.owner === lap.activeVolume?.owner &&
    lap.clipboard.volume.repo === lap.activeVolume?.repo

  // Global Ctrl/Cmd+C / X / V — skipped while typing in a text field, and
  // hooks stay above any early return so their order never changes.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      // Don't hijack a normal text-copy (e.g. selecting a snippet out of the
      // code preview) or anything while the preview modal is open.
      const hasTextSelection = (window.getSelection()?.toString().length ?? 0) > 0
      if (typing || hasTextSelection || previewNode || !lap.activeVolume) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'c' && selectedNodes.length > 0) {
        e.preventDefault()
        lap.copyToClipboard(selectedNodes.map((n) => n.path))
      } else if (e.key === 'x' && selectedNodes.length > 0) {
        e.preventDefault()
        lap.cutToClipboard(selectedNodes.map((n) => n.path))
      } else if (e.key === 'v' && canPaste) {
        e.preventDefault()
        lap.pasteFromClipboard()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lap, selectedNodes, canPaste, previewNode])

  if (!lap.activeVolume) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-400">
        Select or mount a volume from the sidebar to get started.
      </div>
    )
  }

  function toggleSelect(path: string, e: React.MouseEvent) {
    const next = new Set(lap.selected)
    if (e.metaKey || e.ctrlKey) {
      next.has(path) ? next.delete(path) : next.add(path)
    } else {
      next.clear()
      next.add(path)
    }
    lap.setSelected(next)
  }

  function openNode(node: FsNode) {
    if (node.type === 'folder') lap.navigate(node.path)
    else setPreviewNode(node)
  }

  /** Warns (once, per batch) before uploading media, since git keeps every version forever. */
  function confirmMediaIfNeeded(files: File[]): boolean {
    if (!theme.warnOnMediaUpload) return true
    const mediaFiles = files.filter((f) => isMedia(categoryFor(f.name)))
    if (mediaFiles.length === 0) return true
    return window.confirm(
      `${mediaFiles.length} of these ${mediaFiles.length === 1 ? 'is a' : 'are'} image/video file(s). ` +
      `Git keeps every version forever, so media quietly bloats repo size over time. Upload anyway?\n\n` +
      `(Turn this warning off in Settings.)`,
    )
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!confirmMediaIfNeeded(Array.from(files))) return
    setUploadBusy(`Uploading ${files.length} item(s)…`)
    try {
      await lap.uploadFiles(files)
    } finally {
      setUploadBusy(null)
    }
  }

  async function handleNewFolder() {
    const name = window.prompt('Folder name')
    if (!name) return
    await lap.createFolder(name.trim())
  }

  async function handleDelete(paths: string[]) {
    if (paths.length === 0) return
    const ok = window.confirm(
      paths.length === 1
        ? `Delete "${paths[0].split('/').pop()}"? This removes it from the repo history-forward (still recoverable via git history).`
        : `Delete ${paths.length} items?`,
    )
    if (!ok) return
    await lap.deleteNodes(paths)
    lap.setSelected(new Set())
  }

  async function handleDownload(nodes: FsNode[]) {
    if (!lap.client || !lap.activeVolume) return
    if (nodes.length === 1 && nodes[0].type === 'file') {
      await downloadFile(lap.client, lap.activeVolume, nodes[0])
    } else if (nodes.length === 1 && nodes[0].type === 'folder') {
      await downloadFolderAsZip(lap.client, lap.activeVolume, nodes[0], nodes[0].name)
    } else {
      await downloadSelectionAsZip(lap.client, lap.activeVolume, nodes, lap.activeVolume.repo + '-selection')
    }
  }

  function startRename(node: FsNode) {
    setRenaming(node.path)
    setRenameValue(node.name)
  }

  async function commitRename(node: FsNode) {
    const newName = renameValue.trim()
    setRenaming(null)
    if (!newName || newName === node.name) return
    await lap.renameNode(node.path, newName)
  }

  function onDragStartNode(e: React.DragEvent, node: FsNode) {
    const paths = lap.selected.has(node.path) ? [...lap.selected] : [node.path]
    e.dataTransfer.setData(DND_MIME, JSON.stringify(paths))
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDropOnFolder(e: React.DragEvent, destPath: string) {
    e.preventDefault()
    e.stopPropagation() // don't also let this bubble to the pane's own onDrop
    setDragOverPath(null)
    const raw = e.dataTransfer.getData(DND_MIME)
    if (raw) {
      const paths: string[] = JSON.parse(raw)
      lap.moveNodes(paths, destPath)
      return
    }
    if (e.dataTransfer.files?.length) {
      const prevPath = lap.path
      // Temporarily upload into the drop target rather than current folder.
      uploadInto(destPath, e.dataTransfer.files).then(() => {
        if (lap.path === prevPath) lap.refreshTree()
      })
    }
  }

  async function uploadInto(destPath: string, files: FileList) {
    if (!lap.client || !lap.activeVolume) return
    if (!confirmMediaIfNeeded(Array.from(files))) return
    setUploadBusy(`Uploading ${files.length} item(s)…`)
    try {
      for (const file of Array.from(files)) {
        const full = destPath ? `${destPath}/${file.name}` : file.name
        const base64 = await fileToBase64(file)
        await lap.client.uploadFile(lap.activeVolume, full, base64, `Upload ${file.name}`)
      }
      await lap.refreshTree()
    } finally {
      setUploadBusy(null)
    }
  }

  function nodeContextMenu(e: React.MouseEvent, node: FsNode) {
    e.preventDefault()
    e.stopPropagation()
    if (!lap.selected.has(node.path)) {
      lap.setSelected(new Set([node.path]))
    }
    const selNodes = [...(lap.selected.has(node.path) ? lap.selected : [node.path])]
      .map((p) => findNode(lap.tree!, p))
      .filter(Boolean) as FsNode[]
    const finalNodes = selNodes.length > 0 ? selNodes : [node]
    const finalPaths = finalNodes.map((n) => n.path)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Open', onClick: () => openNode(node) },
        { label: 'Download', onClick: () => handleDownload(finalNodes), separatorAfter: true },
        { label: 'Copy', onClick: () => lap.copyToClipboard(finalPaths) },
        { label: 'Cut', onClick: () => lap.cutToClipboard(finalPaths) },
        { label: 'Paste', onClick: () => lap.pasteFromClipboard(), disabled: !canPaste, separatorAfter: true },
        { label: 'Rename', onClick: () => startRename(node), disabled: finalNodes.length > 1 },
        { label: 'Delete', danger: true, onClick: () => handleDelete(finalPaths) },
      ],
    })
  }

  function paneContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    lap.setSelected(new Set())
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'New Folder', onClick: handleNewFolder },
        { label: 'Upload Files…', onClick: () => fileInputRef.current?.click() },
        { label: 'Paste', onClick: () => lap.pasteFromClipboard(), disabled: !canPaste },
        { label: 'Refresh', onClick: () => lap.refreshTree() },
      ],
    })
  }

  return (
    <div className="flex h-full flex-1 flex-col" onContextMenu={paneContextMenu}>
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 border-b border-black/10 bg-white/50 px-3 py-2">
        <button onClick={() => lap.refreshTree()} className="rounded-md p-1.5 text-gray-600 hover:bg-black/5" title="Refresh">
          <RotateCw size={15} />
        </button>
        <div className="mx-1 h-4 w-px bg-black/10" />
        <button onClick={handleNewFolder} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-black/5" title="New Folder">
          <FolderPlus size={15} /> Folder
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-black/5" title="Upload files">
          <Upload size={15} /> Upload
        </button>
        <button onClick={() => folderInputRef.current?.click()} className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-black/5" title="Upload a whole folder">
          Upload folder
        </button>
        <input
          ref={fileInputRef} type="file" multiple hidden
          onChange={(e) => { handleUploadFiles(e.target.files); e.currentTarget.value = '' }}
        />
        <input
          ref={folderInputRef} type="file" multiple hidden
          // @ts-expect-error non-standard attrs for folder picking
          webkitdirectory="" directory=""
          onChange={(e) => { handleUploadFiles(e.target.files); e.currentTarget.value = '' }}
        />

        <div className="mx-1 h-4 w-px bg-black/10" />
        <button
          disabled={selectedNodes.length === 0}
          onClick={() => lap.copyToClipboard(selectedNodes.map((n) => n.path))}
          className="flex items-center gap-1 rounded-md p-1.5 text-gray-600 hover:bg-black/5 disabled:opacity-30"
          title="Copy (Ctrl/Cmd+C)"
        >
          <Copy size={15} />
        </button>
        <button
          disabled={selectedNodes.length === 0}
          onClick={() => lap.cutToClipboard(selectedNodes.map((n) => n.path))}
          className="flex items-center gap-1 rounded-md p-1.5 text-gray-600 hover:bg-black/5 disabled:opacity-30"
          title="Cut (Ctrl/Cmd+X)"
        >
          <Scissors size={15} />
        </button>
        <button
          disabled={!canPaste}
          onClick={() => lap.pasteFromClipboard()}
          className="flex items-center gap-1 rounded-md p-1.5 text-gray-600 hover:bg-black/5 disabled:opacity-30"
          title="Paste (Ctrl/Cmd+V)"
        >
          <ClipboardPaste size={15} />
        </button>

        <div className="mx-1 h-4 w-px bg-black/10" />
        <button
          disabled={selectedNodes.length === 0}
          onClick={() => handleDownload(selectedNodes)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-black/5 disabled:opacity-30"
          title="Download selection"
        >
          <Download size={15} /> Download
        </button>
        <button
          disabled={selectedNodes.length === 0}
          onClick={() => handleDelete(selectedNodes.map((n) => n.path))}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-30"
          title="Delete selection"
        >
          <Trash2 size={15} />
        </button>

        <div className="flex-1" />
        <button onClick={() => setView('grid')} className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-black/10' : 'text-gray-500 hover:bg-black/5'}`}>
          <Grid3x3 size={15} />
        </button>
        <button onClick={() => setView('list')} className={`rounded-md p-1.5 ${view === 'list' ? 'bg-black/10' : 'text-gray-500 hover:bg-black/5'}`}>
          <ListIcon size={15} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b border-black/10 bg-white/30 px-3 py-1.5 text-[12.5px]">
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-gray-400" />}
            <button
              onClick={() => lap.navigate(c.path)}
              onDragOver={(e) => { e.preventDefault(); setDragOverPath(c.path) }}
              onDragLeave={() => setDragOverPath((p) => (p === c.path ? null : p))}
              onDrop={(e) => onDropOnFolder(e, c.path)}
              className={`rounded px-1.5 py-0.5 font-medium ${
                i === crumbs.length - 1 ? 'text-gray-800' : 'text-mac-accent hover:bg-black/5'
              } ${dragOverPath === c.path ? 'drag-over-target' : ''}`}
            >
              {c.label}
            </button>
          </span>
        ))}
      </div>

      {/* Content */}
      <div
        className="relative flex-1 overflow-y-auto p-4"
        onClick={() => lap.setSelected(new Set())}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDropOnFolder(e, lap.path)}
      >
        {lap.loadingTree && <div className="p-8 text-center text-sm text-gray-400">Loading volume…</div>}
        {uploadBusy && (
          <div className="mb-3 rounded-lg bg-mac-accent/10 px-3 py-2 text-xs text-mac-accent">{uploadBusy}</div>
        )}

        {!lap.loadingTree && items.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            This folder is empty. Drag files here, or use Upload.
          </div>
        )}

        {view === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1">
            {items.map((node) => (
              <div
                key={node.path}
                draggable
                onDragStart={(e) => onDragStartNode(e, node)}
                onDragOver={(e) => { if (node.type === 'folder') { e.preventDefault(); setDragOverPath(node.path) } }}
                onDragLeave={() => setDragOverPath((p) => (p === node.path ? null : p))}
                onDrop={(e) => node.type === 'folder' && onDropOnFolder(e, node.path)}
                onClick={(e) => { e.stopPropagation(); toggleSelect(node.path, e) }}
                onDoubleClick={() => openNode(node)}
                onContextMenu={(e) => nodeContextMenu(e, node)}
                title={`${node.name} — ${formatBytes(nodeSize(node))}`}
                className={`icon-tile flex flex-col items-center gap-1 rounded-lg p-2 text-center ${
                  lap.selected.has(node.path) ? 'selected' : ''
                } ${clipboardOwnsSelection(node.path) ? 'cut' : ''} ${dragOverPath === node.path ? 'drag-over-target' : ''}`}
              >
                <FileIcon name={node.name} type={node.type} size={38} />
                {renaming === node.path ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitRename(node)}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename(node)}
                    className="w-full rounded border border-mac-accent px-1 text-center text-[11px] outline-none"
                  />
                ) : (
                  <span className="line-clamp-2 w-full break-words text-[11px] leading-tight text-gray-700">{node.name}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="text-[11px] uppercase text-gray-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {items.map((node) => (
                <tr
                  key={node.path}
                  draggable
                  onDragStart={(e) => onDragStartNode(e, node)}
                  onDragOver={(e) => { if (node.type === 'folder') { e.preventDefault(); setDragOverPath(node.path) } }}
                  onDragLeave={() => setDragOverPath((p) => (p === node.path ? null : p))}
                  onDrop={(e) => node.type === 'folder' && onDropOnFolder(e, node.path)}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(node.path, e) }}
                  onDoubleClick={() => openNode(node)}
                  onContextMenu={(e) => nodeContextMenu(e, node)}
                  className={`icon-tile cursor-default ${lap.selected.has(node.path) ? 'selected' : ''} ${clipboardOwnsSelection(node.path) ? 'cut' : ''} ${dragOverPath === node.path ? 'drag-over-target' : ''}`}
                >
                  <td className="flex items-center gap-2 py-1.5">
                    <FileIcon name={node.name} type={node.type} size={18} />
                    {node.name}
                  </td>
                  <td className="py-1.5 text-gray-400" title={`${nodeSize(node).toLocaleString()} bytes`}>
                    {formatBytes(nodeSize(node))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-black/10 bg-white/40 px-3 py-1 text-[11px] text-gray-500">
        {items.length} item{items.length === 1 ? '' : 's'}
        {selectedNodes.length > 0 && ` · ${selectedNodes.length} selected (${formatBytes(selectedSize)})`}
        {totalSize > 0 && ` · ${formatBytes(totalSize)} total`}
        {lap.clipboard && lap.clipboard.volume.owner === lap.activeVolume?.owner && lap.clipboard.volume.repo === lap.activeVolume?.repo &&
          ` · ${lap.clipboard.paths.length} on clipboard (${lap.clipboard.mode})`}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {previewNode && lap.client && lap.activeVolume && (
        <PreviewModal client={lap.client} volume={lap.activeVolume} node={previewNode} onClose={() => setPreviewNode(null)} />
      )}
    </div>
  )
}
