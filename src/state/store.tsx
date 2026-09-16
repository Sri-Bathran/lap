import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { FsNode, PendingChange, Volume } from '../types'
import { GitHubClient, buildFsTree, collectEmptyFolders, collectFiles, findNode, uniqueChildName } from '../lib/github'
import { fileToBase64 } from '../lib/binary'

const LS_TOKEN_KEY = 'lap.token'
const LS_VOLUMES_KEY = 'lap.volumes'

function loadVolumes(): Volume[] {
  try {
    const raw = localStorage.getItem(LS_VOLUMES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveVolumes(vols: Volume[]) {
  localStorage.setItem(LS_VOLUMES_KEY, JSON.stringify(vols))
}

export type ClipboardMode = 'copy' | 'cut'
export interface ClipboardState {
  mode: ClipboardMode
  paths: string[]
  volume: Volume // clipboard is scoped to the volume it was cut/copied from
}

export interface LapState {
  unlocked: boolean
  autoUnlocking: boolean
  autoUnlockError: string | null
  login: string | null
  client: GitHubClient | null
  volumes: Volume[]
  activeVolume: Volume | null
  path: string
  tree: FsNode | null
  loadingTree: boolean
  selected: Set<string>
  clipboard: ClipboardState | null

  unlockWithToken: (token: string) => Promise<void>
  lock: () => void
  forgetToken: () => void

  addExistingVolume: (owner: string, repo: string, defaultBranch: string) => void
  createVolume: (name: string) => Promise<void>
  selectVolume: (v: Volume) => Promise<void>
  refreshTree: () => Promise<void>
  navigate: (path: string) => void
  setSelected: (paths: Set<string>) => void

  createFolder: (name: string) => Promise<void>
  uploadFiles: (files: FileList | File[]) => Promise<void>
  deleteNodes: (paths: string[]) => Promise<void>
  renameNode: (path: string, newName: string) => Promise<void>
  moveNodes: (paths: string[], destFolderPath: string) => Promise<void>
  copyNodes: (paths: string[], destFolderPath: string) => Promise<void>

  copyToClipboard: (paths: string[]) => void
  cutToClipboard: (paths: string[]) => void
  clearClipboard: () => void
  pasteFromClipboard: () => Promise<void>
}

const LapContext = createContext<LapState | null>(null)

export function LapProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [autoUnlocking, setAutoUnlocking] = useState(true)
  const [autoUnlockError, setAutoUnlockError] = useState<string | null>(null)
  const [login, setLogin] = useState<string | null>(null)
  const [client, setClient] = useState<GitHubClient | null>(null)
  const [volumes, setVolumes] = useState<Volume[]>(() => loadVolumes())
  const [activeVolume, setActiveVolume] = useState<Volume | null>(null)
  const [path, setPath] = useState('')
  const [tree, setTree] = useState<FsNode | null>(null)
  const [loadingTree, setLoadingTree] = useState(false)
  const [selected, setSelectedState] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const tokenRef = useRef<string | null>(null)

  const updateVolumes = useCallback((updater: (prev: Volume[]) => Volume[]) => {
    setVolumes((prev) => {
      const next = updater(prev)
      saveVolumes(next)
      return next
    })
  }, [])

  const doUnlock = useCallback(async (token: string) => {
    const c = new GitHubClient(token)
    const user = await c.verifyToken() // throws if token invalid/revoked
    tokenRef.current = token
    setClient(c)
    setLogin(user.login)
    setUnlocked(true)
  }, [])

  // Remembers the token locally and opens straight to your drives on every
  // future visit to this browser — no passphrase, no re-pasting per session.
  const unlockWithToken = useCallback(
    async (token: string) => {
      await doUnlock(token) // validate first, don't persist a bad token
      localStorage.setItem(LS_TOKEN_KEY, token)
    },
    [doUnlock],
  )

  // Auto sign-in on load if a token is already remembered on this device.
  useEffect(() => {
    const stored = localStorage.getItem(LS_TOKEN_KEY)
    if (!stored) {
      setAutoUnlocking(false)
      return
    }
    doUnlock(stored)
      .catch((err) => {
        localStorage.removeItem(LS_TOKEN_KEY) // stale/revoked — don't keep retrying with it
        setAutoUnlockError(err?.message ?? String(err))
      })
      .finally(() => setAutoUnlocking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshTree = useCallback(async () => {
    if (!client || !activeVolume) return
    setLoadingTree(true)
    try {
      const { entries } = await client.getFullTree(activeVolume)
      setTree(buildFsTree(entries))
    } finally {
      setLoadingTree(false)
    }
  }, [client, activeVolume])

  const selectVolume = useCallback(
    async (v: Volume) => {
      setActiveVolume(v)
      setPath('')
      setSelectedState(new Set())
      setTree(null)
      if (!client) return
      setLoadingTree(true)
      try {
        const { entries } = await client.getFullTree(v)
        setTree(buildFsTree(entries))
      } finally {
        setLoadingTree(false)
      }
    },
    [client],
  )

  const lock = useCallback(() => {
    tokenRef.current = null
    setClient(null)
    setUnlocked(false)
    setLogin(null)
    setActiveVolume(null)
    setTree(null)
    setClipboard(null)
  }, [])

  const forgetToken = useCallback(() => {
    localStorage.removeItem(LS_TOKEN_KEY)
    lock()
  }, [lock])

  const addExistingVolume = useCallback(
    (owner: string, repo: string, defaultBranch: string) => {
      updateVolumes((prev) => {
        if (prev.some((v) => v.owner === owner && v.repo === repo)) return prev
        return [...prev, { owner, repo, defaultBranch, private: true, addedAt: Date.now() }]
      })
    },
    [updateVolumes],
  )

  const createVolume = useCallback(
    async (name: string) => {
      if (!client) throw new Error('Not unlocked')
      const { owner, repo, defaultBranch } = await client.createVolumeRepo(name)
      addExistingVolume(owner, repo, defaultBranch)
    },
    [client, addExistingVolume],
  )

  const navigate = useCallback((p: string) => {
    setPath(p)
    setSelectedState(new Set())
  }, [])

  const setSelected = useCallback((paths: Set<string>) => setSelectedState(paths), [])

  const createFolder = useCallback(
    async (name: string) => {
      if (!client || !activeVolume) return
      const full = path ? `${path}/${name}` : name
      await client.createFolder(activeVolume, full)
      await refreshTree()
    },
    [client, activeVolume, path, refreshTree],
  )

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!client || !activeVolume) return
      const list = Array.from(files)
      for (const file of list) {
        const rel = (file as any).webkitRelativePath || file.name
        const full = path ? `${path}/${rel}` : rel
        const base64 = await fileToBase64(file)
        await client.uploadFile(activeVolume, full, base64, `Upload ${rel}`)
      }
      await refreshTree()
    },
    [client, activeVolume, path, refreshTree],
  )

  const deleteNodes = useCallback(
    async (paths: string[]) => {
      if (!client || !activeVolume || !tree) return
      const blobPaths: string[] = []
      for (const p of paths) {
        const node = findNode(tree, p)
        if (!node) continue
        if (node.type === 'file') {
          blobPaths.push(p)
        } else {
          blobPaths.push(...collectFiles(node).map((f) => f.path))
          blobPaths.push(...collectEmptyFolders(node).map((f) => `${f.path}/.gitkeep`))
        }
      }
      if (blobPaths.length === 0) return
      await client.deletePaths(activeVolume, blobPaths, `Delete ${paths.join(', ')}`)
      await refreshTree()
    },
    [client, activeVolume, tree, refreshTree],
  )

  // Each of rename/move/copy below builds one combined PendingChange list —
  // real files (which carry a sha to preserve) plus every empty folder
  // anywhere in the subtree (which only exist on GitHub as a .gitkeep blob
  // that collectFiles() never surfaces, so it has to be tracked separately
  // via collectEmptyFolders — otherwise an empty subfolder gets silently
  // left behind) — and send it all as a single commit.

  const renameNode = useCallback(
    async (nodePath: string, newName: string) => {
      if (!client || !activeVolume || !tree) return
      const node = findNode(tree, nodePath)
      if (!node) return
      const parentPath = nodePath.includes('/') ? nodePath.slice(0, nodePath.lastIndexOf('/')) : ''
      const newPath = parentPath ? `${parentPath}/${newName}` : newName
      const changes: PendingChange[] = []
      for (const f of node.type === 'file' ? [node] : collectFiles(node)) {
        changes.push({ path: f.path, sha: null })
        changes.push({ path: newPath + f.path.slice(nodePath.length), sha: f.sha! })
      }
      if (node.type === 'folder') {
        const emptyFolders = collectEmptyFolders(node)
        if (emptyFolders.length > 0) {
          const sha = await client.createBlob(activeVolume, '')
          for (const ef of emptyFolders) {
            changes.push({ path: `${ef.path}/.gitkeep`, sha: null })
            changes.push({ path: `${newPath}${ef.path.slice(nodePath.length)}/.gitkeep`, sha })
          }
        }
      }
      if (changes.length === 0) return
      await client.commitChanges(activeVolume, changes, `Rename ${nodePath} -> ${newPath}`)
      await refreshTree()
    },
    [client, activeVolume, tree, refreshTree],
  )

  const moveNodes = useCallback(
    async (paths: string[], destFolderPath: string) => {
      if (!client || !activeVolume || !tree) return
      const changes: PendingChange[] = []
      let emptyBlobSha: string | null = null
      for (const p of paths) {
        const node = findNode(tree, p)
        if (!node) continue
        const newBase = destFolderPath ? `${destFolderPath}/${node.name}` : node.name
        if (newBase === p) continue // no-op, dropped on itself
        if (node.type === 'folder' && (destFolderPath === p || destFolderPath.startsWith(`${p}/`))) {
          continue // can't move a folder into its own descendant
        }
        for (const f of node.type === 'file' ? [node] : collectFiles(node)) {
          changes.push({ path: f.path, sha: null })
          changes.push({ path: newBase + f.path.slice(p.length), sha: f.sha! })
        }
        if (node.type === 'folder') {
          for (const ef of collectEmptyFolders(node)) {
            if (!emptyBlobSha) emptyBlobSha = await client.createBlob(activeVolume, '')
            changes.push({ path: `${ef.path}/.gitkeep`, sha: null })
            changes.push({ path: `${newBase}${ef.path.slice(p.length)}/.gitkeep`, sha: emptyBlobSha })
          }
        }
      }
      if (changes.length === 0) return
      await client.commitChanges(activeVolume, changes, `Move ${paths.length} item(s) to ${destFolderPath || '/'}`)
      await refreshTree()
    },
    [client, activeVolume, tree, refreshTree],
  )

  // Duplicates content at a new path in one commit, reusing blob shas — no
  // re-upload — and auto-resolves name collisions ("x" -> "x copy").
  const copyNodes = useCallback(
    async (paths: string[], destFolderPath: string) => {
      if (!client || !activeVolume || !tree) return
      const destNode = findNode(tree, destFolderPath)
      const changes: PendingChange[] = []
      let emptyBlobSha: string | null = null
      for (const p of paths) {
        const node = findNode(tree, p)
        if (!node) continue
        if (node.type === 'folder' && (destFolderPath === p || destFolderPath.startsWith(`${p}/`))) {
          continue // can't copy a folder into its own descendant
        }
        const targetName = uniqueChildName(destNode, node.name)
        const newBase = destFolderPath ? `${destFolderPath}/${targetName}` : targetName
        for (const f of node.type === 'file' ? [node] : collectFiles(node)) {
          changes.push({ path: newBase + f.path.slice(p.length), sha: f.sha! })
        }
        if (node.type === 'folder') {
          for (const ef of collectEmptyFolders(node)) {
            if (!emptyBlobSha) emptyBlobSha = await client.createBlob(activeVolume, '')
            changes.push({ path: `${newBase}${ef.path.slice(p.length)}/.gitkeep`, sha: emptyBlobSha })
          }
        }
      }
      if (changes.length === 0) return
      await client.commitChanges(activeVolume, changes, `Copy ${paths.length} item(s) to ${destFolderPath || '/'}`)
      await refreshTree()
    },
    [client, activeVolume, tree, refreshTree],
  )

  const copyToClipboard = useCallback(
    (paths: string[]) => {
      if (!activeVolume || paths.length === 0) return
      setClipboard({ mode: 'copy', paths, volume: activeVolume })
    },
    [activeVolume],
  )

  const cutToClipboard = useCallback(
    (paths: string[]) => {
      if (!activeVolume || paths.length === 0) return
      setClipboard({ mode: 'cut', paths, volume: activeVolume })
    },
    [activeVolume],
  )

  const clearClipboard = useCallback(() => setClipboard(null), [])

  const pasteFromClipboard = useCallback(async () => {
    if (!clipboard || !activeVolume) return
    if (clipboard.volume.owner !== activeVolume.owner || clipboard.volume.repo !== activeVolume.repo) {
      // Cross-volume paste would require downloading+reuploading blob bytes
      // (shas aren't portable across repos) — not supported yet.
      return
    }
    if (clipboard.mode === 'cut') {
      await moveNodes(clipboard.paths, path)
      setClipboard(null)
    } else {
      await copyNodes(clipboard.paths, path)
      // copy stays on the clipboard so you can paste it again elsewhere
    }
  }, [clipboard, activeVolume, path, moveNodes, copyNodes])

  const value = useMemo<LapState>(
    () => ({
      unlocked,
      autoUnlocking,
      autoUnlockError,
      login,
      client,
      volumes,
      activeVolume,
      path,
      tree,
      loadingTree,
      selected,
      clipboard,
      unlockWithToken,
      lock,
      forgetToken,
      addExistingVolume,
      createVolume,
      selectVolume,
      refreshTree,
      navigate,
      setSelected,
      createFolder,
      uploadFiles,
      deleteNodes,
      renameNode,
      moveNodes,
      copyNodes,
      copyToClipboard,
      cutToClipboard,
      clearClipboard,
      pasteFromClipboard,
    }),
    [
      unlocked, autoUnlocking, autoUnlockError, login, client, volumes, activeVolume, path, tree,
      loadingTree, selected, clipboard, unlockWithToken, lock, forgetToken, addExistingVolume,
      createVolume, selectVolume, refreshTree, navigate, setSelected, createFolder, uploadFiles,
      deleteNodes, renameNode, moveNodes, copyNodes, copyToClipboard, cutToClipboard, clearClipboard,
      pasteFromClipboard,
    ],
  )

  return <LapContext.Provider value={value}>{children}</LapContext.Provider>
}

export function useLap(): LapState {
  const ctx = useContext(LapContext)
  if (!ctx) throw new Error('useLap must be used within LapProvider')
  return ctx
}
